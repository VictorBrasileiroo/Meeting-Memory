import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commitChunk, createRecording, DB_NAME, getNotes, getRecording, getTranscript, listJobs, updateRecording } from '../src/storage/recordings';
import { makeChunk } from './fixtures/recording';
import { analysisRecording, notesOutput, sourceText } from './fixtures/notes';

const transport = vi.hoisted(() => ({ upload: vi.fn(), transcribe: vi.fn(), remove: vi.fn(), analyze: vi.fn(), probe: vi.fn() }));
vi.mock('../src/gemini/transcription', async (original) => ({ ...await original<typeof import('../src/gemini/transcription')>(), GoogleGeminiTranscriptionClient: class {
  uploadAudio = transport.upload; transcribe = transport.transcribe; deleteFile = transport.remove;
} }));
vi.mock('../src/gemini/analysis', async (original) => ({ ...await original<typeof import('../src/gemini/analysis')>(), GoogleGeminiAnalysisClient: class { analyze = transport.analyze; probe = transport.probe; } }));
let worker: { onmessage: ((event: { data: { type: string; apiKey?: string } }) => void) | null; close: ReturnType<typeof vi.fn> };
let drained: (() => void) | undefined;
async function send(type: string, apiKey?: string) {
  await new Promise<void>((resolve) => { drained = resolve; worker.onmessage!({ data: { type, apiKey } }); });
}
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(1_000_000);
  await new Promise<void>((resolve) => { const call = indexedDB.deleteDatabase(DB_NAME); call.onsuccess = () => resolve(); });
  worker = { onmessage: null, close: vi.fn() };
  vi.stubGlobal('self', worker);
  vi.stubGlobal('postMessage', (message: { type: string }) => { if (message.type === 'DRAINED') { const callback = drained; drained = undefined; callback?.(); } });
  transport.upload.mockReset().mockImplementation(async () => ({ name: `files/${transport.upload.mock.calls.length}`, uri: 'https://file', mimeType: 'audio/webm' }));
  transport.transcribe.mockReset().mockResolvedValue({ rawText: 'Fonte preservada.', annotations: [], speakers: [], interactionId: null });
  transport.remove.mockReset().mockResolvedValue(undefined);
  transport.analyze.mockReset().mockResolvedValue(notesOutput());
  transport.probe.mockReset().mockResolvedValue(undefined);
  await import('../src/queue/local-worker');
  await send('CREDENTIAL', 'test-only-key');
});

it('teste controlado usa o mesmo job/fila: cinco chamadas Lite espaçadas, sem reenviar transcript ou gerar notas', async () => {
  const { retryAnalysis } = await import('../src/storage/recordings');
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  transport.analyze.mockRejectedValueOnce({ status: 400 });
  await createRecording({ ...analysisRecording(), analysisModel: 'gemini-3.6-flash' }); await commitChunk(makeChunk()); await send('ENABLE_TEST_TRANSCRIPTION');
  const before = await getTranscript('chunk-1');
  expect(await retryAnalysis('recording', 'probe')).toBe(1); await send('WAKE');
  expect(transport.probe).toHaveBeenCalledTimes(1); await send('WAKE'); expect(transport.probe).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 4; i++) { vi.setSystemTime(Date.now() + 61000); await send('WAKE'); }
  expect(transport.probe.mock.calls.map((call) => call[2])).toEqual(['TEXT_ONLY', 'JSON_ONLY', 'OUTPUT_LIMIT', 'MINIMAL_SCHEMA', 'NOTES_SCHEMA']);
  expect(transport.probe.mock.calls.every((call) => call[0] === 'gemini-3.5-flash-lite' && call[1] === 'development')).toBe(true);
  expect((await getRecording('recording'))?.analysisModel).toBe('gemini-3.6-flash');
  expect(await getNotes('recording')).toBeUndefined(); expect(await getTranscript('chunk-1')).toEqual(before);
  expect(transport.analyze).toHaveBeenCalledOnce(); expect(transport.upload).toHaveBeenCalledOnce(); expect(transport.transcribe).toHaveBeenCalledOnce();
  expect((await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')).toMatchObject({ status: 'ERROR', analysisProbe: { version: 2, model: 'gemini-3.5-flash-lite', done: true, results: [{ outcome: 'ACCEPTED' }, { outcome: 'ACCEPTED' }, { outcome: 'ACCEPTED' }, { outcome: 'ACCEPTED' }, { outcome: 'ACCEPTED' }] } });
  vi.setSystemTime(Date.now() + 61000); await send('WAKE'); expect(transport.probe).toHaveBeenCalledTimes(5);
  await retryAnalysis('recording'); await send('WAKE'); expect(transport.analyze).toHaveBeenCalledTimes(2); expect(await getNotes('recording')).toBeDefined();
});
it.each([400, 429, 503])('probe para na primeira falha HTTP %s sem retry automático', async (status) => {
  const { retryAnalysis } = await import('../src/storage/recordings');
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null }); transport.analyze.mockRejectedValueOnce({ status: 400 });
  await createRecording(analysisRecording()); await commitChunk(makeChunk()); await send('ENABLE_TEST_TRANSCRIPTION');
  transport.probe.mockRejectedValueOnce({ status }); await retryAnalysis('recording', 'probe'); await send('WAKE');
  vi.setSystemTime(Date.now() + 610000); await send('WAKE'); expect(transport.probe).toHaveBeenCalledOnce();
  expect((await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')).toMatchObject({ status: 'ERROR', errorKind: 'PERMANENT', analysisProbe: { done: true, results: [{ stage: 'TEXT_ONLY', outcome: 'FAILED' }] } });
});

it('teste antigo salvo encerra sem chamada ao Flash e conserva o significado dos índices antigos', async () => {
  const { openDatabase } = await import('../src/storage/recordings');
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  transport.analyze.mockRejectedValueOnce({ status: 400 });
  await createRecording({ ...analysisRecording(), analysisModel: 'gemini-3.6-flash' }); await commitChunk(makeChunk()); await send('ENABLE_TEST_TRANSCRIPTION');
  const failed = (await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')!;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    tx.objectStore('jobs').put({ ...failed, status: 'PENDING', errorKind: null, attempts: 1, analysisProbe: { nextStage: 1, done: false, results: [{ stage: 'JSON_ONLY', outcome: 'ACCEPTED' }] } });
  });
  db.close(); await send('WAKE');
  expect(transport.probe).not.toHaveBeenCalled(); expect(transport.analyze).toHaveBeenCalledOnce();
  const stopped = (await listJobs('recording')).find((job) => job.id === failed.id)!;
  expect(stopped).toMatchObject({ status: 'ERROR', analysisProbe: { done: true, results: [{ stage: 'JSON_ONLY', outcome: 'ACCEPTED' }, { stage: 'OUTPUT_LIMIT', outcome: 'FAILED' }] } });
  expect(await getNotes('recording')).toBeUndefined(); expect((await getTranscript('chunk-1'))?.rawText).toBe(sourceText);
  const { retryAnalysis } = await import('../src/storage/recordings');
  expect(await retryAnalysis('recording', 'probe')).toBe(1); await send('WAKE');
  expect(transport.probe).toHaveBeenCalledExactlyOnceWith('gemini-3.5-flash-lite', 'development', 'TEXT_ONLY', expect.any(AbortSignal));
});

it('transcreve durante captura, aguarda STOP e todas as partes, gera/persiste notas automaticamente uma única vez', async () => {
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  const recording = { ...analysisRecording(2), endedAt: null, status: 'RECORDING', completeness: 'UNKNOWN' as const };
  await createRecording(recording);
  await commitChunk(makeChunk(1)); await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.transcribe).toHaveBeenCalledOnce(); expect(transport.analyze).not.toHaveBeenCalled();
  await commitChunk(makeChunk(2));
  await updateRecording({ ...recording, endedAt: Date.now(), status: 'PROCESSING', completeness: 'COMPLETE' });
  await send('WAKE'); expect(transport.analyze).not.toHaveBeenCalled();
  await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.analyze).toHaveBeenCalledOnce(); expect(transport.transcribe).toHaveBeenCalledTimes(2);
  expect((await getNotes('recording'))?.analysisModel).toBe('gemini-3.5-flash-lite'); expect((await getRecording('recording'))?.status).toBe('COMPLETED');
  expect((await getTranscript('chunk-1'))?.rawText).toBe(sourceText);
  await send('WAKE'); expect(transport.analyze).toHaveBeenCalledOnce();
  worker.onmessage!({ data: { type: 'SHUTDOWN' } }); await Promise.resolve(); vi.resetModules(); await import('../src/queue/local-worker'); await send('CREDENTIAL', 'test-only-key');
  expect(transport.analyze).toHaveBeenCalledOnce(); expect(transport.transcribe).toHaveBeenCalledTimes(2);
});
it('análise indisponível preserva transcrição e espera ação; chave corrigida permite retomar sem retranscrever', async () => {
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  transport.analyze.mockRejectedValueOnce({ status: 404 });
  await createRecording(analysisRecording()); await commitChunk(makeChunk()); await send('ENABLE_TEST_TRANSCRIPTION');
  expect(await getNotes('recording')).toBeUndefined(); expect((await getTranscript('chunk-1'))?.rawText).toBe(sourceText);
  expect((await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')).toMatchObject({ errorKind: 'USER_ACTION_REQUIRED', status: 'ERROR' });
  await send('WAKE'); expect(transport.analyze).toHaveBeenCalledOnce();
  const { retryAnalysis } = await import('../src/storage/recordings'); await retryAnalysis('recording'); await send('WAKE');
  expect(transport.analyze).toHaveBeenCalledTimes(2); expect(transport.transcribe).toHaveBeenCalledOnce(); expect(await getNotes('recording')).toBeDefined();
});
it('nova captura conserva áudio se notas falham e só aplica retenção depois do commit de notas', async () => {
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  transport.analyze.mockRejectedValueOnce({ status: 404 });
  await createRecording({ ...analysisRecording(), retention: 'delete-after-transcription', captureEndReason: 'TAB_CLOSED' });
  const chunk = makeChunk(); chunk.boundary.finalized = true; chunk.boundary.fragmentCount = 1;
  await commitChunk(chunk); await send('ENABLE_TEST_TRANSCRIPTION');
  const { getChunk, retryAnalysis } = await import('../src/storage/recordings');
  expect(await getNotes('recording')).toBeUndefined(); expect((await getChunk(chunk.id))?.blob.size).toBeGreaterThan(0);
  expect(await retryAnalysis('recording')).toBe(1); await send('WAKE');
  expect(await getNotes('recording')).toBeDefined(); expect((await getChunk(chunk.id))?.blob.size).toBe(0);
  expect(transport.transcribe).toHaveBeenCalledOnce();
});
it('HTTP 400 persiste diagnóstico seguro; retry manual repete apenas análise e conclui o mesmo job', async () => {
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  transport.analyze.mockRejectedValueOnce({ status: 400, error: { code: 'invalid_argument', message: 'Unsupported schema. PRIVATE_VALUE' } });
  await createRecording({ ...analysisRecording(), analysisModel: 'gemini-3.6-flash' }); await commitChunk(makeChunk()); await send('ENABLE_TEST_TRANSCRIPTION');
  const failed = (await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')!;
  expect(failed).toMatchObject({ status: 'ERROR', errorKind: 'PERMANENT', lastAnalysisDiagnostic: { apiCode: 'invalid_argument' } });
  expect(JSON.stringify(failed)).not.toContain('PRIVATE_VALUE');
  await send('WAKE'); expect(transport.analyze).toHaveBeenCalledOnce();
  const { retryAnalysis } = await import('../src/storage/recordings'); expect(await retryAnalysis('recording')).toBe(1); await send('WAKE');
  expect(transport.transcribe).toHaveBeenCalledOnce(); expect(transport.upload).toHaveBeenCalledOnce(); expect(transport.analyze).toHaveBeenCalledTimes(2);
  expect((await getNotes('recording'))?.analysisModel).toBe('gemini-3.6-flash');
  expect((await listJobs('recording')).filter((job) => job.kind === 'ANALYZE_RECORDING')).toHaveLength(1);
  expect((await listJobs('recording')).find((job) => job.id === failed.id)?.status).toBe('COMPLETE');
});

it('retry explícito com Lite sobrevive a 429/restart e conclui sem retranscrever nem voltar ao Flash', async () => {
  const { retryAnalysis } = await import('../src/storage/recordings');
  transport.transcribe.mockResolvedValue({ rawText: sourceText, annotations: [], speakers: [], interactionId: null });
  transport.analyze.mockRejectedValueOnce({ status: 400 }).mockRejectedValueOnce({ status: 429 });
  await createRecording({ ...analysisRecording(), analysisModel: 'gemini-3.6-flash' }); await commitChunk(makeChunk()); await send('ENABLE_TEST_TRANSCRIPTION');
  const before = await getTranscript('chunk-1');
  const id = (await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')!.id;
  expect(await retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite')).toBe(1); await send('WAKE');
  expect(transport.analyze.mock.calls[1]![0].analysisModel).toBe('gemini-3.5-flash-lite');
  expect(await retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite')).toBe(0);
  worker.onmessage!({ data: { type: 'SHUTDOWN' } }); await Promise.resolve(); vi.resetModules(); await import('../src/queue/local-worker'); await send('CREDENTIAL', 'test-only-key');
  expect(transport.analyze).toHaveBeenCalledTimes(2);
  vi.setSystemTime(Date.now() + 61000); await send('WAKE');
  expect(transport.analyze).toHaveBeenCalledTimes(3);
  expect(transport.analyze.mock.calls.slice(1).every((call) => call[0].analysisModel === 'gemini-3.5-flash-lite')).toBe(true);
  expect(await getNotes('recording')).toMatchObject({ analysisModel: 'gemini-3.5-flash-lite', promptVersion: 2 });
  expect(await getTranscript('chunk-1')).toEqual(before); expect(transport.upload).toHaveBeenCalledOnce(); expect(transport.transcribe).toHaveBeenCalledOnce();
  expect((await listJobs('recording')).filter((job) => job.kind === 'ANALYZE_RECORDING').map((job) => job.id)).toEqual([id]);
});
afterEach(async () => {
  worker.onmessage?.({ data: { type: 'SHUTDOWN' } });
  await Promise.resolve(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('backlog de cinco partes retoma pelo poll, sem novo clique; cleanup e captura seguem durante espera', async () => {
  for (let i = 1; i <= 5; i++) await commitChunk(makeChunk(i));
  // This suite runs the short-chunk build: grant the five test authorizations
  // upfront. Production has an unlimited budget and shares the same drain.
  for (let i = 0; i < 5; i++) await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.transcribe).toHaveBeenCalledTimes(3);
  expect(transport.upload).toHaveBeenCalledTimes(3);
  expect(transport.remove).toHaveBeenCalledTimes(3);
  const waiting = (await listJobs('recording')).filter((job) => job.status === 'PENDING');
  expect(waiting).toHaveLength(2);
  expect(waiting.every((job) => job.attempts === 0 && job.leaseOwner === null)).toBe(true);
  // Capture can persist another chunk while the queue is rate-limited.
  await commitChunk(makeChunk(6));
  expect((await listJobs('recording')).filter((job) => job.kind === 'TRANSCRIBE_CHUNK')).toHaveLength(6);
  vi.setSystemTime(1_061_000);
  const finished = new Promise<void>((resolve) => { drained = resolve; });
  await vi.advanceTimersByTimeAsync(2000); await finished;
  expect(transport.transcribe).toHaveBeenCalledTimes(5);
  expect(transport.upload).toHaveBeenCalledTimes(5);
  expect(transport.remove).toHaveBeenCalledTimes(5);
  expect((await listJobs('recording')).filter((job) => job.kind === 'TRANSCRIBE_CHUNK' && job.status === 'COMPLETE')).toHaveLength(5);
});
it('rede falha após upload; próxima tentativa reutiliza remoto e transcript salvo não é refeito', async () => {
  await commitChunk(makeChunk());
  transport.transcribe.mockRejectedValueOnce(new TypeError('offline'));
  await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.upload).toHaveBeenCalledTimes(1);
  vi.setSystemTime(1_010_000); await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.upload).toHaveBeenCalledTimes(1);
  expect(transport.transcribe).toHaveBeenCalledTimes(2);
  expect((await getTranscript('chunk-1'))?.rawText).toBe('Fonte preservada.');
  await send('WAKE');
  expect(transport.transcribe).toHaveBeenCalledTimes(2);
});
it('429 pausa outras partes e retoma automaticamente sem repetir upload confirmado', async () => {
  await commitChunk(makeChunk(1)); await commitChunk(makeChunk(2));
  transport.transcribe.mockRejectedValueOnce({ status: 429, headers: new Headers({ 'Retry-After': '90' }) });
  await send('ENABLE_TEST_TRANSCRIPTION'); await send('ENABLE_TEST_TRANSCRIPTION'); await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.transcribe).toHaveBeenCalledTimes(1);
  vi.setSystemTime(1_089_000); await send('WAKE');
  expect(transport.transcribe).toHaveBeenCalledTimes(1);
  vi.setSystemTime(1_090_000); await send('WAKE');
  expect(transport.transcribe).toHaveBeenCalledTimes(3);
  expect(transport.upload).toHaveBeenCalledTimes(2);
  expect(transport.remove).toHaveBeenCalledTimes(2);
});
it('reinício do Dedicated Worker conserva a janela no IDB e não repete partes completas', async () => {
  for (let i = 1; i <= 4; i++) await commitChunk(makeChunk(i));
  for (let i = 0; i < 4; i++) await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.transcribe).toHaveBeenCalledTimes(3);
  worker.onmessage!({ data: { type: 'SHUTDOWN' } }); await Promise.resolve();
  vi.resetModules();
  await import('../src/queue/local-worker');
  await send('CREDENTIAL', 'test-only-key');
  await send('ENABLE_TEST_TRANSCRIPTION');
  expect(transport.transcribe).toHaveBeenCalledTimes(3);
  expect((await listJobs('recording')).find((job) => job.chunkId === 'chunk-4')).toMatchObject({ attempts: 0, status: 'PENDING' });
  vi.setSystemTime(1_061_000);
  const finished = new Promise<void>((resolve) => { drained = resolve; });
  await vi.advanceTimersByTimeAsync(2000); await finished;
  expect(transport.transcribe).toHaveBeenCalledTimes(4);
  expect(transport.upload).toHaveBeenCalledTimes(4);
});
