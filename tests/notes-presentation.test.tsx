import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { NotesContent } from '../src/session/NotesContent';
import { copyNotes, downloadNotes, notesMarkdown } from '../src/session/notes-export';
import { emptyOutput, meetingNotes } from './fixtures/notes';
import { OriginalTranscript } from '../src/session/OriginalTranscript';
import { makeTranscript } from './fixtures/recording';
import { SettingsApp } from '../src/settings/SettingsApp';
import { ANALYSIS_MODEL_IDS, analysisModels } from '../src/domain/analysis-models';
import { AnalysisFailure } from '../src/session/AnalysisFailure';
import { analysisDiagnostic } from '../src/domain/analysis-diagnostic';
import type { Job } from '../src/storage/recordings';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('falha permanente mostra diagnóstico seguro e ação explícita somente de notas; lease ativo não oferece retry', () => {
  const job: Job = { id: 'analysis', kind: 'ANALYZE_RECORDING', recordingId: 'recording', chunkId: '', status: 'ERROR', attempts: 5, generation: 1, leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: 0, errorKind: 'PERMANENT', lastError: 'HTTP 400', lastAnalysisDiagnostic: analysisDiagnostic({ status: 400, error: { code: 'invalid_argument', message: 'Unsupported schema. PRIVATE_VALUE' } }) };
  const html = renderToStaticMarkup(<AnalysisFailure job={job} onRetry={async () => undefined} />);
  expect(html).toContain('Reprocessar somente as notas'); expect(html).toContain('Diagnóstico seguro da Gemini'); expect(html).not.toContain('PRIVATE_VALUE');
  expect(html).toContain('mesmo modelo');
  expect(renderToStaticMarkup(<AnalysisFailure job={{ ...job, status: 'PROCESSING' }} onRetry={async () => undefined} />)).not.toContain('Reprocessar somente as notas');
});
it('teste isolado exige ação explícita, informa até cinco chamadas Lite/cobrança e exporta progresso seguro', () => {
  const job: Job = { id: 'analysis', kind: 'ANALYZE_RECORDING', recordingId: 'recording', chunkId: '', status: 'ERROR', attempts: 1, generation: 1, leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: 0, errorKind: 'PERMANENT', lastError: 'HTTP 400' };
  const html = renderToStaticMarkup(<AnalysisFailure job={job} onRetry={async () => undefined} onProbe={async () => undefined} />);
  expect(html).toContain('Testar integração com texto fictício (Lite)'); expect(html).toContain('até 5 chamadas'); expect(html).toContain('Pode gerar cobrança'); expect(html).toContain('sem reenviar a reunião'); expect(html).toContain('gemini-3.5-flash-lite');
  const running = renderToStaticMarkup(<AnalysisFailure job={{ ...job, status: 'PENDING', analysisProbe: { nextStage: 1, done: false, results: [{ stage: 'JSON_ONLY', outcome: 'ACCEPTED' }] } }} onRetry={async () => undefined} onProbe={async () => undefined} />);
  expect(running).not.toContain('Testar integração com texto fictício'); expect(running).toContain('integrationProbe'); expect(running).toContain('JSON_ONLY');
});
it('retry com Lite tem ação explícita, fonte salva e informação de cobrança; não aparece durante execução', () => {
  const job: Job = { id: 'analysis', kind: 'ANALYZE_RECORDING', recordingId: 'recording', chunkId: '', status: 'ERROR', attempts: 5, generation: 1, leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: 0, errorKind: 'PERMANENT', lastError: 'HTTP 400' };
  const html = renderToStaticMarkup(<AnalysisFailure job={job} onRetry={async () => undefined} onRetryLite={async () => undefined} />);
  expect(html).toContain('Reprocessar notas com Lite'); expect(html).toContain('transcrição salva'); expect(html).toContain('pode gerar cobrança');
  expect(renderToStaticMarkup(<AnalysisFailure job={{ ...job, status: 'PROCESSING' }} onRetry={async () => undefined} onRetryLite={async () => undefined} />)).not.toContain('Reprocessar notas com Lite');
});
it('configurações mostram três modelos e aplicação às próximas sessões, sem prometer cota diária', () => {
  const html = renderToStaticMarkup(<SettingsApp />);
  expect(html).toContain('Modelo para gerar notas');
  for (const id of ANALYSIS_MODEL_IDS) { expect(html).toContain(`value="${id}"`); expect(html).toContain(analysisModels[id].label); }
  expect(html).toContain('Vale para as próximas sessões'); expect(html).toContain('https://aistudio.google.com/usage'); expect(html).not.toContain('por dia');
});
it('fonte integral continua consultável em área secundária, sem fabricar falantes ausentes', () => {
  const transcript = makeTranscript(); transcript.rawText = 'Primeira frase. Fronteira repetida.';
  const html = renderToStaticMarkup(<OriginalTranscript transcripts={[transcript]} />);
  expect(html).toContain('<details class="transcript-card">'); expect(html).toContain('Ver transcrição original'); expect(html).toContain(transcript.rawText);
  expect(html).toContain('Copiar transcrição'); expect(html).toContain('id="source-chunk-1"'); expect(html).not.toContain('Falante 1');
});
it('exibe somente categorias preenchidas, modelo, evidência e responsáveis presentes', () => {
  const notes = meetingNotes(); notes.output.sections.push({ kind: 'risks', items: [] });
  const html = renderToStaticMarkup(<NotesContent notes={notes} />);
  expect(html).toContain('Decisões'); expect(html).not.toContain('<h2>Riscos</h2>'); expect(html).toContain('Modelo utilizado: gemini-3.5-flash-lite');
  expect(html).toContain('Responsável: Ana'); expect(html).toContain('Prazo: sexta'); expect(html).toContain('Ver evidência na transcrição');
  notes.output.tasks[0]!.owner = null; notes.output.tasks[0]!.deadline = null;
  const absent = renderToStaticMarkup(<NotesContent notes={notes} />); expect(absent).not.toContain('Responsável:'); expect(absent).not.toContain('Prazo:');
});
it('ausência é resultado válido e texto HTML não executa', () => {
  const notes = meetingNotes(); notes.output = emptyOutput();
  expect(renderToStaticMarkup(<NotesContent notes={notes} />)).toContain('Não encontramos conteúdo suficiente');
  notes.output.title = '<script>alert(1)</script>';
  const html = renderToStaticMarkup(<NotesContent notes={notes} />); expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
});
it('Markdown conserva títulos, categorias presentes, modelo e acentos; cópia usa o mesmo texto', async () => {
  const notes = meetingNotes(); const text = notesMarkdown(notes);
  expect(text).toContain('## Decisões'); expect(text).toContain('## Tarefas'); expect(text).toContain('Responsável: Ana'); expect(text).not.toContain('## Riscos');
  expect(text).toContain(notes.analysisModel); expect(text).not.toContain('apiKey');
  const writeText = vi.fn(async () => undefined); vi.stubGlobal('navigator', { clipboard: { writeText } });
  await copyNotes(notes); expect(writeText).toHaveBeenCalledWith(text);
  writeText.mockRejectedValueOnce(new Error('denied')); await expect(copyNotes(notes)).rejects.toThrow('denied');
});
it('exporta Blob Markdown e libera URL local; falha também limpa recursos', () => {
  vi.useFakeTimers(); const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
  downloadNotes(meetingNotes()); expect(link.download).toBe('meeting-memory-recording.md'); expect(link.click).toHaveBeenCalledOnce(); expect(create.mock.calls[0]![0]).toBeInstanceOf(Blob);
  vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith('blob:test'); expect(link.remove).toHaveBeenCalledOnce();
  link.click.mockImplementationOnce(() => { throw new Error('blocked'); }); expect(() => downloadNotes(meetingNotes())).toThrow('blocked'); vi.runAllTimers(); expect(revoke).toHaveBeenCalledTimes(2);
});
