import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureSession } from '../src/capture/capture-session';
import { RotatingRecorder } from '../src/capture/rotating-recorder';
import { captureIntegrity } from '../src/domain/capture-integrity';
import { hasCompleteAnalysisInput } from '../src/domain/analysis-input';
import { initialSnapshot, type Snapshot } from '../src/domain/contracts';
import { SNAPSHOT_KEY } from '../src/background/foundation';
import { capturedTabIsClosed, closeOffscreen, handleCaptureEvent, handleCaptureRequest, handleTabCaptureEnded, reconcileCapture } from '../src/background/capture-coordinator';
import { claimJob, confirmCaptureStarted, createRecording, DB_NAME, enqueueAnalysis, finalizeCapture, getRecording, listChunks, listJobs, listTranscripts, persistTranscript, updateRecording, type Recording } from '../src/storage/recordings';
import { makeTranscript } from './fixtures/recording';

const id = '00000000-0000-4000-8000-000000000007';
// Synthetic bytes: EBML signature and payload. This verifies the finalization
// protocol, not decoding real browser-produced WebM.
const webm = () => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3])]);
class Recorder extends EventTarget {
  state = 'inactive'; mimeType = 'audio/webm;codecs=opus'; audioBitsPerSecond = 128_000;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  stopCalls = 0; empty = false; brokenHeader = false;
  start() { this.state = 'recording'; }
  stop() {
    this.stopCalls++; this.state = 'inactive';
    this.ondataavailable?.({ data: this.empty ? new Blob() : this.brokenHeader ? new Blob(['invalid']) : webm() } as BlobEvent);
    this.dispatchEvent(new Event('stop'));
  }
}
async function setup(options: { closed?: boolean; empty?: boolean; brokenHeader?: boolean } = {}) {
  const track = () => Object.assign(new EventTarget(), { readyState: 'live', stop: vi.fn() }) as unknown as MediaStreamTrack;
  const tab = track(); const mic = track();
  const stream = (track: MediaStreamTrack) => ({ getAudioTracks: () => [track], getTracks: () => [track] }) as MediaStream;
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const context = Object.assign(new EventTarget(), { state: 'running', destination: {},
    createMediaStreamSource: node, createGain: () => ({ ...node(), gain: { value: 1 } }),
    createAnalyser: () => ({ ...node(), fftSize: 512 }), createMediaStreamDestination: () => ({ ...node(), stream: {} }),
    close: vi.fn(async () => undefined), resume: vi.fn(async () => undefined) });
  const recorders: Recorder[] = []; const notify = vi.fn();
  const isClosed = vi.fn(async () => options.closed ?? true);
  const capture: CaptureSession = new CaptureSession({ getTab: async () => stream(tab), getMic: async () => stream(mic),
    context: () => context as unknown as AudioContext,
    recorder: () => { const r = new Recorder(); r.empty = options.empty ?? false; r.brokenHeader = options.brokenHeader ?? false; recorders.push(r); return r as unknown as MediaRecorder; },
    createRotation: (id, mixed, factory) => new RotatingRecorder(id, mixed, factory, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 }, message => capture.interrupt(message)),
    isCapturedTabClosed: isClosed, notify });
  const recording: Recording = { id, createdAt: Date.now(), startedAt: Date.now(), endedAt: null, profile: 'general', analysisModel: 'gemini-3.5-flash-lite', retention: 'keep-local', status: 'RECORDING', revision: 1, durationMs: 0, chunkCount: 0, completeness: 'UNKNOWN', interruption: null };
  await createRecording(recording); await capture.start(id, 'synthetic-stream');
  const values: Record<string, unknown> = { [SNAPSHOT_KEY]: { ...initialSnapshot('capture'), status: 'RECORDING', recordingId: id, targetTabId: 7, startedAt: recording.startedAt, revision: 2 } };
  const closeDocument = vi.fn(async () => undefined);
  const sendMessage = vi.fn(async (message: { type: string }) => {
    if (message.type === 'STATUS') return { ok: true, status: capture.status() };
    if (message.type === 'TAB_CLOSED') return { ok: !(await capture.closeTab()).interrupted };
    if (message.type === 'STOP') return { ok: !(await capture.stop()).interrupted };
    return { ok: true };
  });
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}`, getContexts: async () => [{}], sendMessage },
    tabs: { query: vi.fn(async () => options.closed === false ? [{ id: 7 }] : []) },
    offscreen: { closeDocument }, storage: { local: { get: async (key: string) => ({ [key]: values[key] }), set: async (value: object) => { Object.assign(values, value); } } } });
  return { capture, recorders, notify, tab, mic, isClosed, values, closeDocument, sendMessage, snapshot: () => values[SNAPSHOT_KEY] as Snapshot };
}
beforeEach(async () => {
  await new Promise<void>(resolve => { const req = indexedDB.deleteDatabase(DB_NAME); req.onsuccess = () => resolve(); });
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(100_000); vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('fechamento normal, último dataavailable e integridade', () => {
  it.each([0, 4500, 8999, 9500, 10_500])('fechar em %i ms finaliza a fonte e agenda notas uma vez após transcrever', async elapsed => {
    const f = await setup(); await vi.advanceTimersByTimeAsync(elapsed);
    await handleTabCaptureEnded(99, 'closed'); expect(f.capture.status().state).toBe('RECORDING');
    await handleTabCaptureEnded(7, 'closed');
    await handleTabCaptureEnded(7, 'stopped');
    await handleTabCaptureEnded(7, 'closed');
    const recording = (await getRecording(id))!; const chunks = await listChunks(id);
    expect(recording).toMatchObject({ status: 'PROCESSING', completeness: 'COMPLETE', captureEndReason: 'TAB_CLOSED', interruption: null });
    expect(f.snapshot()).toMatchObject({ status: 'PROCESSING', interrupted: false, captureEndReason: 'TAB_CLOSED' });
    expect(captureIntegrity(chunks, [], chunks.length)).toBe(true);
    expect(f.recorders.every(recorder => recorder.stopCalls === 1)).toBe(true);
    expect(chunks.every(chunk => chunk.blob.size === 7 && chunk.boundary.fragmentCount === 1 && chunk.boundary.finalized)).toBe(true);
    expect(chunks.length).toBe(elapsed < 9000 ? 1 : 2);
    expect(await enqueueAnalysis(id)).toBe(false);
    for (const chunk of chunks) {
      const job = (await claimJob('transcriber', Date.now(), undefined, ['TRANSCRIBE_CHUNK']))!;
      await persistTranscript(job.id, 'transcriber', job.generation, { ...makeTranscript(chunk.index), id: chunk.id, chunkId: chunk.id, recordingId: id, sourceSize: chunk.blob.size, rawText: 'Fixture sintética para notas.' });
    }
    expect(hasCompleteAnalysisInput((await getRecording(id))!, await listChunks(id), await listTranscripts(id))).toBe(true);
    expect(await enqueueAnalysis(id)).toBe(true); expect(await enqueueAnalysis(id)).toBe(false);
    expect((await listJobs(id)).filter(job => job.kind === 'ANALYZE_RECORDING')).toHaveLength(1);
  });
  it.each(['manual-first', 'closed-first'] as const)('STOP simultâneo %s compartilha a promessa e não fecha offscreen durante flush', async order => {
    const f = await setup(); await vi.advanceTimersByTimeAsync(9500);
    const first = order === 'manual-first' ? f.capture.stop() : f.capture.closeTab();
    const second = order === 'manual-first' ? f.capture.closeTab() : f.capture.stop();
    expect(first).toBe(second);
    await closeOffscreen(); expect(f.closeDocument).not.toHaveBeenCalled();
    await Promise.all([first, second]);
    expect(f.recorders.map(recorder => recorder.stopCalls)).toEqual([1, 1]);
    expect((await getRecording(id))?.completeness).toBe('COMPLETE');
    await handleCaptureEvent({ event: 'CAPTURE_AUTO_STOPPED', recordingId: id, message: '' });
    const after = f.snapshot();
    expect(await handleCaptureRequest({ protocolVersion: 1, requestId: id, target: 'background', type: 'STOP_CAPTURE', recordingId: id, expectedRevision: 2 }, after)).toEqual(after);
  });
  it('ended antes de onRemoved encerra imediatamente e aceita confirmação concorrente da aba fechada', async () => {
    const f = await setup(); let confirm!: (closed: boolean) => void;
    f.isClosed.mockImplementation(() => new Promise(resolve => { confirm = resolve; }));
    f.tab.dispatchEvent(new Event('ended')); expect(f.capture.status().state).toBe('STOPPING');
    const stopped = f.capture.closeTab(); confirm(false); await stopped;
    expect(f.notify).toHaveBeenCalledWith('CAPTURE_AUTO_STOPPED', id, expect.any(String));
    expect((await getRecording(id))?.completeness).toBe('COMPLETE');
  });
  it('ended com aba existente mantém parcial; microfone perdido domina fechamento simultâneo', async () => {
    const f = await setup({ closed: false }); f.tab.dispatchEvent(new Event('ended'));
    expect((await f.capture.stop()).interrupted).toBe(true);
    expect((await getRecording(id))?.completeness).toBe('PARTIAL');
    expect(f.notify).toHaveBeenCalledWith('CAPTURE_INTERRUPTED', id, expect.any(String));
  });
  it('microfone perdido durante flush não se torna sucesso automático', async () => {
    const f = await setup(); const stopped = f.capture.closeTab(); f.mic.dispatchEvent(new Event('ended'));
    expect((await stopped).interrupted).toBe(true);
    expect((await getRecording(id))?.completeness).toBe('PARTIAL');
    expect(await enqueueAnalysis(id)).toBe(false);
  });
  it.each([{ empty: true }, { brokenHeader: true }])('dados vazios ou cabeçalho inválido ficam parciais: %j', async options => {
    const f = await setup(options);
    await f.capture.closeTab().catch(() => undefined);
    expect((await getRecording(id))?.completeness).toBe('PARTIAL'); expect(await enqueueAnalysis(id)).toBe(false);
    expect(await listChunks(id)).toHaveLength(1);
  });
  it('recupera commit confirmado após perda de mensagem/restart, sem recapturar nem duplicar processamento', async () => {
    const f = await setup(); await vi.advanceTimersByTimeAsync(2000); await f.capture.closeTab();
    // The durable recording has committed; the snapshot still says RECORDING.
    expect(f.snapshot().status).toBe('RECORDING');
    const recovered = await reconcileCapture(f.snapshot());
    expect(recovered).toMatchObject({ status: 'PROCESSING', captureEndReason: 'TAB_CLOSED' });
    expect(f.recorders).toHaveLength(1);
    expect((await listChunks(id))[0]?.blob.size).toBe(7);
    expect(await finalizeCapture(id, 1, false, 'TAB_CLOSED')).toBe(true);
  });
  it('snapshot STOPPING e chunks salvos não promovem uma captura parcial', async () => {
    const f = await setup(); await f.capture.stop(true);
    const result = await reconcileCapture({ ...f.snapshot(), status: 'STOPPING' });
    expect(result.status).toBe('ERROR'); expect(result.interrupted).toBe(true);
    expect((await getRecording(id))?.completeness).toBe('PARTIAL');
  });
  it('erro de consulta ao navegador não é prova de aba fechada', async () => {
    await setup(); vi.mocked(chrome.tabs.query).mockRejectedValueOnce(new Error('browser unavailable'));
    expect(await capturedTabIsClosed(7)).toBe(false);
  });
  it('lacunas, tamanho inconsistente e ausência de certificado impedem integridade', async () => {
    const f = await setup(); await vi.advanceTimersByTimeAsync(10500); await f.capture.closeTab();
    const chunks = await listChunks(id);
    for (const mutate of [
      (value: typeof chunks) => { value[1]!.index = 3; },
      (value: typeof chunks) => { value[1]!.boundary.observedStartMs = 10001; value[1]!.approximateStartMs = 10001; },
      (value: typeof chunks) => { value[0]!.boundary.sizeBytes++; },
      (value: typeof chunks) => { value[0]!.boundary.finalized = false; },
      (value: typeof chunks) => { value[1]!.overlapMs = 2000; },
    ]) {
      const changed = structuredClone(chunks); mutate(changed); expect(captureIntegrity(changed, [], 2)).toBe(false);
    }
  });
  it('erro real do recorder domina fechamento normal e preserva áudio já salvo', async () => {
    const f = await setup(); const stopped = f.capture.closeTab(); f.recorders[0]!.onerror?.();
    await expect(stopped).rejects.toThrow();
    expect((await getRecording(id))?.completeness).toBe('PARTIAL'); expect(await enqueueAnalysis(id)).toBe(false);
    expect(f.notify).toHaveBeenCalledWith('CAPTURE_FAILED', id, expect.any(String));
    await handleCaptureEvent({ event: 'CAPTURE_FAILED', recordingId: id, message: 'Falha sintética; fonte salva para revisão.' });
    expect(f.snapshot().failure?.hasRecoverableData).toBe(true);
  });
  it('fechamento antes do ACK de START finaliza com início observado; ACK atrasado não ressuscita RECORDING', async () => {
    const f = await setup(); const original = (await getRecording(id))!;
    await updateRecording({ ...original, startedAt: null, status: 'STARTING' });
    await vi.advanceTimersByTimeAsync(500); await f.capture.closeTab();
    const committed = (await getRecording(id))!;
    expect(committed).toMatchObject({ startedAt: 100_000, endedAt: 100_500, completeness: 'COMPLETE', status: 'PROCESSING' });
    expect(await confirmCaptureStarted(id, 100_000)).toEqual(committed);
    expect(await getRecording(id)).toEqual(committed);
  });
});
