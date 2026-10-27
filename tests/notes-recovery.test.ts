import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverNotesOutput } from '../src/domain/notes-recovery';
import { evidenceMatcher } from '../src/domain/note-evidence';
import { notesValidationSchema } from '../src/domain/notes-validation';
import { validateNotesOutput } from '../src/domain/notes';
import { analysisSourceKey, prepareAnalysis, AnalysisError } from '../src/domain/analysis-input';
import { classifyAnalysisError, GoogleGeminiAnalysisClient } from '../src/gemini/analysis';
import { claimJob, commitChunk, createRecording, DB_NAME, enqueueAnalysis, failJob, getNotes, getRecording, listJobs, listTranscripts, persistNotes, persistTranscript, retryAnalysis } from '../src/storage/recordings';
import { makeChunk, makeTranscript } from './fixtures/recording';
import { analysisRecording, emptyOutput, notesOutput, sourceText } from './fixtures/notes';

const note = (text: string, chunkId = 'part-a', quote = text) => ({ text, nature: 'established' as const, evidence: [{ chunkId, quote }] });
beforeEach(async () => {
  await new Promise<void>(resolve => { const req = indexedDB.deleteDatabase(DB_NAME); req.onsuccess = () => resolve(); });
});
afterEach(() => vi.unstubAllGlobals());
describe('recuperação conservadora por item', () => {
  it('duas partes longas, sem espaço entre falas: mantém itens provados e fontes literais sem alterar rawText', () => {
    const sources = [
      { chunkId: 'part-a', rawText: 'Contexto sintético de planejamento. '.repeat(7000) + 'Decidimos usar IndexedDB.Ana vai revisar até sexta.' },
      { chunkId: 'part-b', rawText: 'Discussão sintética de riscos e testes. '.repeat(7000) + 'O limite é 12,5%.João disse “não publicar”.' },
    ];
    const original = structuredClone(sources);
    const value = { ...emptyOutput(), summary: [note('Decidimos usar IndexedDB. Ana vai revisar até sexta.'), note('O limite é 12,5%. João disse "não publicar".', 'part-b'), note('Aprovamos publicar amanhã.')],
      tasks: [{ description: 'Revisar.', owner: 'Ana', deadline: 'sexta', status: 'defined' as const, evidence: [{ chunkId: 'part-a', quote: 'Ana vai revisar até sexta.' }] }] };
    const { validation, ...output } = recoverNotesOutput(value, 'development', sources);
    expect(output.summary).toHaveLength(2); expect(output.tasks).toHaveLength(1);
    expect(validation).toMatchObject({ omittedItems: 1, recoveredQuotes: 2, issues: [{ code: 'EVIDENCE_NOT_FOUND', count: 1 }] });
    for (const item of [...output.summary, ...output.tasks]) for (const ref of item.evidence) expect(sources.find(source => source.chunkId === ref.chunkId)!.rawText.includes(ref.quote)).toBe(true);
    expect(() => validateNotesOutput(output, 'development', sources)).not.toThrow();
    expect(sources).toEqual(original); expect(value.summary[0]!.evidence[0]!.quote).toContain('. Ana');
    expect(JSON.stringify(validation)).not.toMatch(/Ana|João|IndexedDB|rawText|part-a|part-b/);
  });
  it('distingue parte errada, inexistente e evidência fabricada sem transferir citações entre partes', () => {
    const output = recoverNotesOutput({ ...emptyOutput(), summary: [note('A'), note('B'), note('C'), note('A', 'unknown')] }, 'general', [{ chunkId: 'part-a', rawText: 'A' }, { chunkId: 'part-b', rawText: 'B' }]);
    expect(output.summary.map(item => item.text)).toEqual(['A']);
    expect(output.validation).toMatchObject({ omittedItems: 3, issues: [{ code: 'WRONG_PART', count: 1 }, { code: 'EVIDENCE_NOT_FOUND', count: 1 }, { code: 'UNKNOWN_PART', count: 1 }] });
  });
  it.each([
    ['Ana entrega 12,5% até sexta.', 'Ana entrega 125% até sexta.'],
    ['Ana entrega 12 até sexta.', 'Ana entrega 13 até sexta.'],
    ['Ana entrega até sexta.', 'Ana entrega até segunda.'],
    ['Ana entrega até sexta.', 'Aná entrega até sexta.'],
    ['Ana não entrega.', 'Ana entrega.'],
    ['Não, aprovado.', 'Não aprovado.'],
    ['Podemos aprovar?', 'Podemos aprovar.'],
    ['Ana-Maria entrega.', 'Ana Maria entrega.'],
    ['Somente Mariana entrega.', 'Ana'],
  ])('não força números, nomes, prazos, negações ou sentido: %s', (raw, quote) => {
    expect(evidenceMatcher(raw)(quote)).toBeNull();
  });
  it('tolera espaços e aspas tipográficas, mas rejeita correspondência normalizada ambígua', () => {
    expect(evidenceMatcher('Ana disse “sim”.João confirmou.')( 'Ana disse "sim". João confirmou.')).toBe('Ana disse “sim”.João confirmou.');
    expect(evidenceMatcher('Ana\nrevisa. Ana\t revisa.')('Ana revisa.')).toBeNull();
    expect(evidenceMatcher('Ana revisa. Ana revisa.')('Ana revisa.')).toBe('Ana revisa.');
  });
  it('omite tarefa inteira com responsável ou prazo não sustentado; não atribui Ana a Mariana', () => {
    const value = notesOutput();
    value.tasks = [value.tasks[0]!, { ...value.tasks[0]!, owner: 'Inventado' }, { ...value.tasks[0]!, deadline: 'amanhã' },
      { ...value.tasks[0]!, evidence: [{ chunkId: 'chunk-1', quote: 'Mariana revisa até sexta.' }] }];
    const result = recoverNotesOutput(value, 'development', [{ chunkId: 'chunk-1', rawText: sourceText + 'Mariana revisa até sexta.' }]);
    expect(result.tasks).toHaveLength(1); expect(result.sections[0]!.items).toHaveLength(1);
    expect(result.validation?.issues).toEqual([{ code: 'UNSUPPORTED_OWNER', count: 2 }, { code: 'UNSUPPORTED_DEADLINE', count: 1 }]);
  });
  it('reúne seções duplicadas e omite sugestão em decisões, sem promover hipótese', () => {
    const value = notesOutput(); value.sections.push(structuredClone(value.sections[0]!));
    value.sections[1]!.items.push({ ...note('Talvez possamos mudar o tema.', 'chunk-1'), nature: 'suggestion' });
    const result = recoverNotesOutput(value, 'development', [{ chunkId: 'chunk-1', rawText: sourceText }]);
    expect(result.sections).toHaveLength(1); expect(result.sections[0]!.items).toHaveLength(1);
    expect(result.validation?.issues).toEqual([{ code: 'INVALID_NATURE', count: 1 }, { code: 'DUPLICATE_SECTION', count: 1 }]);
  });
  it('sem evidências retorna ausência explícita com limitação; estrutura inválida continua bloqueada', () => {
    const result = recoverNotesOutput({ ...emptyOutput(), title: 'Título sem suporte', summary: [note('Fabricado')] }, 'general', [{ chunkId: 'part-a', rawText: 'Outra conversa.' }]);
    expect(result).toMatchObject({ title: null, summary: [], validation: { omittedItems: 1 } });
    expect(() => recoverNotesOutput({ ...emptyOutput(), tasks: [{}] }, 'general', [])).toThrow();
    expect(() => notesValidationSchema.parse({ version: 1, omittedItems: 1, recoveredQuotes: 0, issues: [], rawText: 'private' })).toThrow();
  });
  it('seções duplicadas muito grandes respeitam o limite e informam omissões sem falha global', () => {
    const items = Array.from({ length: 200 }, (_, index) => note(`Nota ${index}`, 'part-a', 'Fonte sintética.'));
    const result = recoverNotesOutput({ ...emptyOutput(), sections: [{ kind: 'topics', items }, { kind: 'topics', items: items.map(item => ({ ...item, text: `${item.text} segunda` })) }] }, 'general', [{ chunkId: 'part-a', rawText: 'Fonte sintética.' }]);
    expect(result.sections[0]!.items).toHaveLength(200);
    expect(result.validation).toMatchObject({ omittedItems: 200, issues: [{ code: 'DUPLICATE_SECTION', count: 1 }, { code: 'SECTION_LIMIT', count: 200 }] });
  });
});

it('SDK interceptado: IDs curtos ordenados voltam aos IDs reais antes do commit atômico parcial', async () => {
  const r = analysisRecording(2); await createRecording(r);
  const sources = [makeTranscript(), makeTranscript(2)].map(item => ({ ...item, rawText: sourceText.repeat(1500) }));
  for (const transcript of sources) {
    await commitChunk(makeChunk(transcript.chunkIndex));
    const job = (await claimJob('transcriber', Date.now(), undefined, ['TRANSCRIBE_CHUNK']))!;
    await persistTranscript(job.id, 'transcriber', job.generation, transcript);
  }
  const value = notesOutput(); value.tasks[0]!.evidence = [{ chunkId: 'p2', quote: 'Ana vai corrigir o bug até sexta.' }];
  value.sections[0]!.items[0]!.evidence[0]!.chunkId = 'p1'; value.summary = [note('Fabricado', 'p1')];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init); const body = JSON.parse(await req.text());
    const parts = JSON.parse(body.input).parts;
    expect(parts.map((part: { chunkId: string }) => part.chunkId)).toEqual(['p1', 'p2']);
    expect(body.input).not.toContain('chunk-1'); expect(body.model).toBe(r.analysisModel);
    return new Response(JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] }] }), { headers: { 'content-type': 'application/json' } });
  }));
  const { validation, ...output } = await new GoogleGeminiAnalysisClient('synthetic-key').analyze(r, [makeChunk(2), makeChunk()], [...sources].reverse(), new AbortController().signal);
  expect(prepareAnalysis(r, [makeChunk(), makeChunk(2)], sources).sourceIds.get('p2')).toBe('chunk-2');
  expect(output.tasks[0]!.evidence[0]!.chunkId).toBe('chunk-2');
  await enqueueAnalysis(r.id); const job = (await claimJob('analyzer', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const sourceBefore = await listTranscripts(r.id);
  expect(await persistNotes(job.id, 'analyzer', job.generation, output, analysisSourceKey(sourceBefore), validation)).toBe(true);
  expect((await getNotes(r.id))?.validation?.omittedItems).toBe(1);
  expect((await getRecording(r.id))?.status).toBe('COMPLETED');
  expect(await listTranscripts(r.id)).toEqual(sourceBefore);
});

it('INVALID_OUTPUT conhecido espera retry explícito; reprocessa só notas de sessão antiga completa', async () => {
  const recording = analysisRecording(); await createRecording(recording); await commitChunk(makeChunk());
  const transcriber = (await claimJob('t', Date.now(), undefined, ['TRANSCRIBE_CHUNK']))!;
  await persistTranscript(transcriber.id, 't', transcriber.generation, { ...makeTranscript(), rawText: sourceText });
  await enqueueAnalysis(recording.id); const job = (await claimJob('a', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const failure = classifyAnalysisError(new AnalysisError('INVALID_OUTPUT', 'EVIDENCE'));
  expect(failure.kind).toBe('USER_ACTION_REQUIRED'); await failJob(job.id, 'a', job.generation, failure);
  expect(await claimJob('a', Date.now() + 999999, undefined, ['ANALYZE_RECORDING'])).toBeNull();
  expect(await retryAnalysis(recording.id)).toBe(1);
  expect((await listJobs(recording.id)).filter(item => item.kind === 'TRANSCRIBE_CHUNK')).toEqual([expect.objectContaining({ status: 'COMPLETE', attempts: 1 })]);
  expect((await listTranscripts(recording.id))[0]?.rawText).toBe(sourceText);
});
