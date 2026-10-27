import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitChunk, createRecording, DB_NAME } from '../src/storage/recordings';
import { listPartReferences, meetingTitle, sessionPhase, type SessionData } from '../src/session/session-data';
import { readSessionLocation } from '../src/session/session-location';
import { NotesContent } from '../src/session/NotesContent';
import { OriginalTranscript, transcriptText } from '../src/session/OriginalTranscript';
import { SessionResult } from '../src/session/SessionResult';
import { analysisRecording, meetingNotes } from './fixtures/notes';
import { makeChunk, makeTranscript } from './fixtures/recording';

const data = (): SessionData => ({ recording: analysisRecording(2), notes: undefined, jobs: [], transcripts: [], parts: [{ id: 'chunk-1', index: 1 }, { id: 'chunk-2', index: 2 }] });
beforeEach(async () => { await new Promise<void>((resolve, reject) => { const call = indexedDB.deleteDatabase(DB_NAME); call.onsuccess = () => resolve(); call.onerror = () => reject(call.error); }); });

it('lista somente chaves do índice existente, sem get/getAll nem suposição sobre IDs', async () => {
  await createRecording(analysisRecording());
  await commitChunk({ ...makeChunk(9), id: 'random-id-part-nine' });
  await commitChunk({ ...makeChunk(2), id: 'arbitrary-two' });
  await commitChunk({ ...makeChunk(1), recordingId: 'other-recording' });
  const storeGet = vi.spyOn(IDBObjectStore.prototype, 'get');
  const indexGet = vi.spyOn(IDBIndex.prototype, 'getAll');
  try {
    expect(await listPartReferences('recording')).toEqual([{ id: 'arbitrary-two', index: 2 }, { id: 'random-id-part-nine', index: 9 }]);
    expect(await listPartReferences('unknown')).toEqual([]);
    expect(storeGet).not.toHaveBeenCalled(); expect(indexGet).not.toHaveBeenCalled();
  } finally { storeGet.mockRestore(); indexGet.mockRestore(); }
});

it('prefere título gerado e usa perfil/data quando não há título', () => {
  const recording = analysisRecording(); const notes = meetingNotes(); notes.output.title = '  Revisão do projeto  ';
  expect(meetingTitle(recording, notes)).toBe('Revisão do projeto');
  notes.output.title = '   ';
  expect(meetingTitle(recording, notes)).toBe(`Desenvolvimento · ${new Date(recording.createdAt).toLocaleDateString('pt-BR')}`);
});

describe('estados sustentados por commits e contratos existentes', () => {
  it('não anuncia notas prontas só porque a sessão está concluída', () => {
    const view = data(); view.recording!.status = 'COMPLETED';
    expect(sessionPhase(view).label).toBe('Sessão sem notas');
    view.notes = meetingNotes(); expect(sessionPhase(view).label).toBe('Notas prontas');
  });
  it('separa transcrição, preparação e geração', () => {
    const view = data(); expect(sessionPhase(view).label).toBe('Transcrevendo partes');
    view.transcripts = [makeTranscript(), makeTranscript(2)]; expect(sessionPhase(view).label).toBe('Preparando análise');
    view.jobs = [{ id: 'analyze', kind: 'ANALYZE_RECORDING', recordingId: 'recording', chunkId: '', status: 'PROCESSING', attempts: 1, nextAttemptAt: 0, leaseOwner: 'worker', leaseExpiresAt: 9000, generation: 1, lastError: null, errorKind: null }];
    expect(sessionPhase(view).label).toBe('Gerando notas');
    view.jobs[0]!.analysisProbe = { nextStage: 0, done: false, results: [] };
    expect(sessionPhase(view).label).toBe('Teste técnico em andamento');
    view.jobs[0]!.status = 'WAITING_FOR_CREDENTIALS'; expect(sessionPhase(view).label).toBe('Configure sua chave Gemini');
    Object.assign(view.jobs[0]!, { status: 'ERROR', errorKind: 'RETRYABLE', nextAttemptAt: 3000, lastError: 'HTTP 429' });
    expect(sessionPhase(view, 2000).label).toBe('Aguardando limite da API');
    Object.assign(view.jobs[0]!, { nextAttemptAt: 0, lastError: 'Network' }); expect(sessionPhase(view).label).toBe('Aguardando nova tentativa');
    view.jobs[0]!.attempts = 5; expect(sessionPhase(view).tone).toBe('error');
  });
  it('reconhece legado, captura e interrupção sem criar notas parciais', () => {
    const view = data(); view.recording!.analysisModel = undefined; expect(sessionPhase(view).label).toBe('Transcrição preservada');
    view.recording!.status = 'RECORDING'; expect(sessionPhase(view).label).toBe('Gravação em andamento');
    view.recording!.status = 'STOPPING'; expect(sessionPhase(view).label).toBe('Salvando última parte');
    view.notes = meetingNotes(); view.recording!.completeness = 'PARTIAL';
    expect(sessionPhase(view).label).toBe('Gravação interrompida'); expect(sessionPhase(view).description).toContain('Nenhuma análise parcial');
  });
});

it.each([
  ['', { tab: 'notes' }], ['#unknown', { tab: 'notes' }], ['#transcript', { tab: 'transcript' }], ['#audio', { tab: 'audio' }],
  ['#source-abc%20%2F1', { tab: 'transcript', target: 'source-abc /1' }], ['#notes-decisions', { tab: 'notes', target: 'notes-decisions' }], ['#source-%ZZ', { tab: 'notes' }],
])('restaura fragmento %s de maneira previsível', (hash, expected) => expect(readSessionLocation(hash)).toEqual(expected));

it('cópia integral mantém overlap, espaços e quebras de linha sem aplicar anotações', () => {
  const first = makeTranscript(); first.rawText = '  Linha original.\n\nFronteira repetida.\n';
  const second = makeTranscript(2); second.rawText = 'Fronteira repetida.\nOutra linha.';
  expect(transcriptText([first, second])).toBe('Parte 1\n  Linha original.\n\nFronteira repetida.\n\n\nParte 2\nFronteira repetida.\nOutra linha.');
  const html = renderToStaticMarkup(<OriginalTranscript expanded transcripts={[first, second]} />);
  expect(html).toContain('Copiar transcrição'); expect(html).toContain('id="source-chunk-2"'); expect(html).not.toContain('Falante 1');
});

it('usa documento sem cards por seção e fontes literais codificadas na URL', () => {
  const notes = meetingNotes(); notes.output.sections[0]!.items[0]!.evidence = [{ chunkId: 'source /#special', quote: '<literal>\nNão corrigir.' }];
  const html = renderToStaticMarkup(<NotesContent notes={notes} />);
  expect(html).not.toContain('class="card'); expect(html).toContain('Ver fonte'); expect(html).toContain('#source-source%20%2F%23special'); expect(html).toContain('&lt;literal&gt;\nNão corrigir.');
});

it('ID não encontrado não apresenta outra sessão nem ações de geração', () => {
  const html = renderToStaticMarkup(<SessionResult data={{ ...data(), recording: undefined }} />);
  expect(html).toContain('Reunião não encontrada'); expect(html).not.toContain('Notas prontas'); expect(html).not.toContain('Reprocessar');
});
