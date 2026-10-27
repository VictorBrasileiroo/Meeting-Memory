import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleCaptureRequest, reconcileCapture } from '../src/background/capture-coordinator';
import { initialSnapshot, type Snapshot } from '../src/domain/contracts';
import { claimJob, commitChunk, createRecording, DB_NAME, failJob, getRecording, listJobs, listTranscripts, persistNotes, persistTranscript, updateRecording } from '../src/storage/recordings';
import { analysisSourceKey } from '../src/domain/analysis-input';
import { analysisRecording, notesOutput, sourceText } from './fixtures/notes';
import { makeChunk, makeTranscript } from './fixtures/recording';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/storage/settings';

const id = '00000000-0000-4000-8000-000000000001';
let values: Record<string, unknown>;
beforeEach(async () => {
  await new Promise<void>((resolve) => { const req = indexedDB.deleteDatabase(DB_NAME); req.onsuccess = () => resolve(); });
  values = { [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, analysisModel: 'gemini-3.8-flash' } };
  vi.stubGlobal('chrome', { tabs: { query: async () => [{ id: 1, url: 'https://meeting.test' }] }, tabCapture: { getMediaStreamId: async () => 'ephemeral' },
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}`, getContexts: async () => [{}], sendMessage: async () => ({ ok: true, status: { state: 'RECORDING', startedAt: Date.now() } }) },
    offscreen: { closeDocument: vi.fn() }, storage: { local: { get: async () => values, set: async (input: Record<string, unknown>) => { Object.assign(values, input); } } } });
});
afterEach(() => vi.unstubAllGlobals());
const snapshot = (): Snapshot => ({ ...initialSnapshot('capture'), recordingId: id, startedAt: 1000, endedAt: 2000, status: 'PROCESSING', revision: 2 });
async function transcribed() {
  await createRecording({ ...analysisRecording(), id }); await commitChunk({ ...makeChunk(), recordingId: id });
  const job = (await claimJob('transcriber'))!; await persistTranscript(job.id, 'transcriber', job.generation, { ...makeTranscript(), recordingId: id, rawText: sourceText });
}
it('modelo é fotografado em START; mudança nas preferências não altera sessão', async () => {
  const next = await handleCaptureRequest({ protocolVersion: 1, target: 'background', requestId: id, type: 'START_CAPTURE', recordingId: null, expectedRevision: 0, payload: { profile: 'research' } }, initialSnapshot('capture'));
  expect((await getRecording(next.recordingId!))?.analysisModel).toBe('gemini-3.8-flash');
  values[SETTINGS_KEY] = { ...DEFAULT_SETTINGS };
  expect((await getRecording(next.recordingId!))?.analysisModel).toBe('gemini-3.8-flash');
});
it('transcrição completa prepara análise; somente notas persistidas permitem COMPLETED', async () => {
  await transcribed(); const next = await reconcileCapture(snapshot());
  expect(next.status).toBe('PROCESSING'); expect(next.processingStage).toBe('preparing');
  const job = (await claimJob('analyzer', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const running = await reconcileCapture(next); expect(running.processingStage).toBe('analyzing');
  await persistNotes(job.id, 'analyzer', job.generation, notesOutput(), analysisSourceKey(await listTranscripts(id)));
  expect((await reconcileCapture(running)).status).toBe('COMPLETED');
});
it('modelo indisponível sai de PROCESSING com fonte preservada, retry explícito não retranscreve', async () => {
  await transcribed(); const next = await reconcileCapture(snapshot()); const job = (await claimJob('analyzer', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(job.id, 'analyzer', job.generation, { kind: 'USER_ACTION_REQUIRED', message: 'Modelo indisponível.' });
  const failed = await reconcileCapture(next); expect(failed.status).toBe('ERROR'); expect(failed.failure?.message).toBe('Modelo indisponível.');
  const recovered = await handleCaptureRequest({ protocolVersion: 1, requestId: id, target: 'background', type: 'RECOVER_CAPTURE', recordingId: id, expectedRevision: failed.revision }, failed);
  expect(recovered.status).toBe('PROCESSING'); expect((await listJobs(id)).find((item) => item.kind === 'TRANSCRIBE_CHUNK')?.attempts).toBe(1);
});
it('ausência de parte final e captura interrompida geram falha explícita, nunca análise parcial', async () => {
  await transcribed(); const recording = (await getRecording(id))!;
  await updateRecording({ ...recording, chunkCount: 2 });
  const failed = await reconcileCapture(snapshot()); expect(failed.status).toBe('ERROR'); expect(failed.failure?.message).toContain('incompleta');
  expect((await listJobs(id)).some((job) => job.kind === 'ANALYZE_RECORDING')).toBe(false);
});
it('comando explícito reprocessa somente análise permanente, inclusive sessão salva fora do snapshot', async () => {
  await transcribed(); const recording = (await getRecording(id))!; await updateRecording({ ...recording, analysisModel: 'gemini-3.6-flash' });
  const current = await reconcileCapture(snapshot()); const job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(job.id, 'A', job.generation, { kind: 'PERMANENT', message: 'HTTP 400' });
  const idle = { ...initialSnapshot('capture'), revision: current.revision + 1 };
  const req = { protocolVersion: 1 as const, requestId: id, target: 'background' as const, type: 'RETRY_ANALYSIS' as const, analysisModel: 'gemini-3.5-flash-lite' as const, recordingId: id, expectedRevision: idle.revision };
  expect(await handleCaptureRequest(req, idle)).toEqual(idle);
  expect(await handleCaptureRequest(req, idle)).toEqual(idle);
  const jobs = await listJobs(id); expect(jobs.filter((item) => item.kind === 'ANALYZE_RECORDING')).toHaveLength(1);
  expect(jobs.find((item) => item.kind === 'ANALYZE_RECORDING')?.status).toBe('PENDING');
  expect(jobs.find((item) => item.kind === 'ANALYZE_RECORDING')?.analysisModelOverride).toBe('gemini-3.5-flash-lite');
  expect(jobs.find((item) => item.kind === 'TRANSCRIBE_CHUNK')?.attempts).toBe(1);
});
