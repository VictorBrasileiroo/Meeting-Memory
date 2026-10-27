import { wasRecordingDeleted, listAllJobs } from '../storage/recordings';
import { initialSnapshot, snapshotSchema, type Snapshot } from '../domain/contracts';
import { SNAPSHOT_KEY } from './foundation';
import type { Request } from '../messaging/protocol';
import { clearActiveRecording, confirmCaptureStarted, createRecording, getRecording, listChunks, listJobs, retryFailedTranscriptions, retryOneHttp404, scheduleCleanupForFailedTranscriptions, updateRecording } from '../storage/recordings';
import { transition, type RecordingEvent } from '../domain/recording-state';
import { isTerminalJob, JOB_MAX_ATTEMPTS } from '../queue/job-policy';
import { loadSettings } from '../storage/settings';
import { enqueueAnalysis, getNotes, listTranscripts, retryAnalysis } from '../storage/recordings';
import { hasCompleteAnalysisInput } from '../domain/analysis-input';
import { captureIntegrity } from '../domain/capture-integrity';
import type { Recording } from '../storage/recordings';

const OFFSCREEN_URL = 'src/offscreen/offscreen.html';
type OffscreenReply = { ok: boolean; status?: { recordingId: string | null; state: string; startedAt: number | null }; message?: string };
let creating: Promise<void> | null = null;
const failure = (message: string, hasRecoverableData = false) => ({ phase: 'capture' as const, message, recoverable: false, hasRecoverableData });
function advance(snapshot: Snapshot, event: RecordingEvent): Snapshot {
  return { ...snapshot, ...transition({ status: snapshot.status, failure: snapshot.failure }, event), revision: snapshot.revision + 1 };
}
export async function offscreenExists(): Promise<boolean> {
  if (!chrome.runtime.getContexts) return false;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)] });
  return contexts.length > 0;
}
export async function ensureOffscreen(forProcessing = false): Promise<void> {
  if (await offscreenExists()) return;
  if (!creating) creating = (async () => {
    if (await offscreenExists()) return;
    await chrome.offscreen.createDocument({ url: OFFSCREEN_URL, reasons: forProcessing ? ['WORKERS'] : ['USER_MEDIA', 'WORKERS'], justification: forProcessing ? 'Concluir transcrição pendente em worker dedicado.' : 'Capturar áudio da aba e do microfone e processar partes em worker dedicado.' });
  })().finally(() => { creating = null; });
  await creating;
}
export async function closeOffscreen(): Promise<void> {
  // A manually resumed saved session can differ from the popup's session.
  // Keep the existing executor while any processing/cleanup remains pending.
  if ((await listAllJobs()).some(job => !isTerminalJob(job))) return;
  if (await offscreenExists()) {
    const live = await askOffscreen({ type: 'STATUS' }).catch(() => null);
    if (live?.status && live.status.state !== 'IDLE') return;
    await chrome.offscreen.closeDocument();
  }
}
async function askOffscreen(message: Record<string, unknown>): Promise<OffscreenReply> {
  return chrome.runtime.sendMessage({ target: 'offscreen-capture', ...message }) as Promise<OffscreenReply>;
}
export async function readCaptureSnapshot(): Promise<Snapshot> {
  const raw = (await chrome.storage.local.get(SNAPSHOT_KEY))[SNAPSHOT_KEY];
  const parsed = snapshotSchema.safeParse(raw);
  return parsed.success && parsed.data.mode === 'capture' ? parsed.data : initialSnapshot('capture');
}
export async function saveCaptureSnapshot(snapshot: Snapshot): Promise<Snapshot> {
  const valid = snapshotSchema.parse(snapshot);
  await chrome.storage.local.set({ [SNAPSHOT_KEY]: valid });
  return valid;
}
const removedTabs = new Set<number>();
export function noteRemovedTab(tabId: number): void {
  removedTabs.add(tabId);
  if (removedTabs.size > 256) removedTabs.delete(removedTabs.values().next().value!);
}
export async function capturedTabIsClosed(tabId: number): Promise<boolean> {
  if (removedTabs.has(tabId)) return true;
  try { return !(await chrome.tabs.query({})).some(tab => tab.id === tabId); }
  catch { return false; } // A browser/API failure is not proof of closure.
}
export async function confirmCapturedTabClosed(tabId: number): Promise<boolean> {
  if (await capturedTabIsClosed(tabId)) return true;
  // Chromium may report stream end while the closing tab is still enumerable.
  // Stop/flush already happens in CaptureSession; briefly await the closure fact.
  await new Promise(resolve => setTimeout(resolve, 150));
  return capturedTabIsClosed(tabId);
}
async function committedCapture(snapshot: Snapshot, recording: Recording): Promise<Snapshot | null> {
  if (recording.endedAt === null || recording.startedAt === null || recording.completeness !== 'COMPLETE' || recording.interruption) return null;
  const chunks = await listChunks(recording.id);
  if (!captureIntegrity(chunks, await listTranscripts(recording.id), recording.chunkCount)) return null;
  return saveCaptureSnapshot({ ...snapshot, status: 'PROCESSING', startedAt: recording.startedAt, endedAt: recording.endedAt,
    failure: null, interrupted: false, captureEndReason: recording.captureEndReason, revision: snapshot.revision + 1 });
}

// Called inside the background's serial queue. Only a confirmed target closure
// is a normal automatic stop; capture errors and lost devices stay partial.
export async function handleTabCaptureEnded(tabId: number, event: 'closed' | 'stopped' | 'error'): Promise<void> {
  const snapshot = await readCaptureSnapshot();
  if (snapshot.targetTabId !== tabId || !snapshot.recordingId || !['STARTING', 'RECORDING', 'STOPPING'].includes(snapshot.status)) return;
  let closed = event === 'closed';
  if (event === 'stopped') closed = await confirmCapturedTabClosed(tabId);
  if (!closed || event === 'error') {
    await askOffscreen({ type: 'INTERRUPT', recordingId: snapshot.recordingId, message: 'A captura da aba foi interrompida pelo navegador.' }).catch(() => undefined);
    return;
  }
  const stopping = await saveCaptureSnapshot({ ...snapshot, status: 'STOPPING', revision: snapshot.revision + 1 });
  try {
    const reply = await askOffscreen({ type: 'TAB_CLOSED', recordingId: snapshot.recordingId });
    if (!reply.ok) throw new Error('Finalização automática incompleta.');
    const recording = await getRecording(snapshot.recordingId);
    const processing = recording && await committedCapture(stopping, recording);
    if (!processing) throw new Error('Integridade da captura não comprovada.');
    await reconcileCapture(processing);
  } catch {
    // Reconciliation can recover a commit whose message/ack was lost. It must
    // never promote a PARTIAL recording just because some chunks exist.
    await reconcileCapture(stopping);
  }
}
export async function reconcileCapture(snapshot: Snapshot): Promise<Snapshot> {
  const deleted = snapshot.recordingId && await wasRecordingDeleted(snapshot.recordingId);
  if (deleted) snapshot = await saveCaptureSnapshot({ ...initialSnapshot('capture'), revision: snapshot.revision + 1 });
  // Deleted sessions are no longer in recordings, but their remote cleanups
  // must still wake the executor and participate in closeOffscreen's guard.
  if ((await listAllJobs()).some(job => job.kind === 'DELETE_REMOTE_FILE' && !isTerminalJob(job)) && !await offscreenExists()) await ensureOffscreen(true).catch(() => undefined);
  if ((snapshot.status === 'PROCESSING' || (snapshot.status === 'ERROR' && snapshot.failure?.phase === 'processing')) && snapshot.recordingId) {
    await scheduleCleanupForFailedTranscriptions(snapshot.recordingId);
    await enqueueAnalysis(snapshot.recordingId);
    const jobs = await listJobs(snapshot.recordingId);
    if (jobs.some((job) => !isTerminalJob(job)) && !await offscreenExists()) await ensureOffscreen(true).catch(() => undefined);
    const transcriptionJobs = jobs.filter((job) => job.kind === 'TRANSCRIBE_CHUNK');
    const notes = await getNotes(snapshot.recordingId);
    if (notes) {
      const completed = await saveCaptureSnapshot(snapshot.status === 'PROCESSING' ? advance(snapshot, { type: 'COMPLETE' }) : { ...snapshot, status: 'COMPLETED', failure: null, revision: snapshot.revision + 1 });
      await clearActiveRecording(snapshot.recordingId);
      if (jobs.every(isTerminalJob)) await closeOffscreen().catch(() => undefined);
      return completed;
    }
    const processingJobs = jobs.filter((job) => job.kind !== 'DELETE_REMOTE_FILE');
    const failedJob = processingJobs.find((job) => job.status === 'WAITING_FOR_CREDENTIALS' || (job.status === 'ERROR' && (job.errorKind !== 'RETRYABLE' || job.attempts >= JOB_MAX_ATTEMPTS)));
    const recording = await getRecording(snapshot.recordingId);
    const allTranscribed = transcriptionJobs.length > 0 && transcriptionJobs.every((job) => job.status === 'COMPLETE');
    const chunks = recording ? await listChunks(recording.id) : [];
    const missingInput = !recording || (recording.endedAt !== null && (recording.completeness !== 'COMPLETE' || !recording.chunkCount || chunks.length !== recording.chunkCount
      || chunks.some((chunk) => !transcriptionJobs.some((job) => job.chunkId === chunk.id))
      || (allTranscribed && !hasCompleteAnalysisInput(recording, chunks, await listTranscripts(recording.id)))));
    if (snapshot.status === 'PROCESSING' && (failedJob || missingInput || (allTranscribed && !recording?.analysisModel))) {
      const message = failedJob?.lastError ?? (missingInput ? 'Gravação ou transcrição incompleta. Consulte os dados preservados; nenhuma análise parcial foi feita.' : 'Esta sessão anterior não tem modelo de notas definido. A transcrição foi preservada.');
      const failed = await saveCaptureSnapshot(advance(snapshot, { type: 'FAILURE', failure: { phase: 'processing', message, recoverable: Boolean(failedJob), hasRecoverableData: true } }));
      if (jobs.every(isTerminalJob)) await closeOffscreen().catch(() => undefined);
      return failed;
    }
    if (snapshot.status === 'ERROR' && jobs.every(isTerminalJob)) await closeOffscreen().catch(() => undefined);
    if (snapshot.status === 'PROCESSING') {
      const stage = jobs.some((job) => job.kind === 'ANALYZE_RECORDING' && job.status === 'PROCESSING') ? 'analyzing' : allTranscribed ? 'preparing' : 'transcribing';
      if (snapshot.processingStage !== stage) return saveCaptureSnapshot({ ...snapshot, processingStage: stage, revision: snapshot.revision + 1 });
    }
    return snapshot;
  }
  if (snapshot.status === 'COMPLETED' && snapshot.recordingId) {
    if (!await getNotes(snapshot.recordingId)) return reconcileCapture(await saveCaptureSnapshot({ ...snapshot, status: 'PROCESSING', failure: null, revision: snapshot.revision + 1 }));
    const cleanup = (await listJobs(snapshot.recordingId)).filter((job) => job.kind === 'DELETE_REMOTE_FILE');
    if (cleanup.some((job) => !isTerminalJob(job)) && !await offscreenExists()) await ensureOffscreen(true).catch(() => undefined);
    return snapshot;
  }
  if (!['STARTING', 'RECORDING', 'STOPPING'].includes(snapshot.status)) return snapshot;
  let live: OffscreenReply | null = null;
  if (await offscreenExists()) {
    try { live = await askOffscreen({ type: 'STATUS' }); } catch { /* Context vanished. */ }
  }
  if (live?.ok && live.status?.recordingId === snapshot.recordingId) {
    if (live.status.state === 'RECORDING' && snapshot.status === 'STARTING') {
      return saveCaptureSnapshot({ ...advance(snapshot, { type: 'CAPTURE_READY' }), startedAt: live.status.startedAt ?? Date.now() });
    }
    return snapshot;
  }
  if (snapshot.status === 'STARTING' && Date.now() - (snapshot.startRequestedAt ?? 0) < 20_000) return snapshot;
  const finalized = snapshot.recordingId ? await getRecording(snapshot.recordingId) : undefined;
  const recovered = finalized && await committedCapture(snapshot, finalized);
  if (recovered) return reconcileCapture(recovered);
  if (snapshot.recordingId) {
    const recording = await getRecording(snapshot.recordingId).catch(() => undefined);
    if (recording) { const chunks = await listChunks(snapshot.recordingId).catch(() => []); await updateRecording({ ...recording, status: 'INTERRUPTED', endedAt: Date.now(), chunkCount: chunks.length, durationMs: snapshot.startedAt ? Date.now() - snapshot.startedAt : 0, completeness: 'PARTIAL', interruption: 'Offscreen encerrado durante a captura.', revision: recording.revision + 1 }).catch(() => undefined); }
  }
  return saveCaptureSnapshot({ ...snapshot, status: 'ERROR', failure: failure('A captura foi interrompida ou o offscreen foi encerrado.', Boolean(snapshot.recordingId && (await listChunks(snapshot.recordingId).catch(() => [])).length)), interrupted: true, revision: snapshot.revision + 1 });
}
export async function handleCaptureRequest(request: Request, snapshot: Snapshot): Promise<Snapshot> {
  if (request.type === 'GET_SNAPSHOT') return reconcileCapture(snapshot);
  if (request.type === 'STOP_CAPTURE' && ['STOPPING', 'PROCESSING', 'COMPLETED', 'ERROR'].includes(snapshot.status) && request.recordingId === snapshot.recordingId) return snapshot;
  if (request.type === 'RETRY_ANALYSIS' || request.type === 'PROBE_ANALYSIS') {
    if (request.expectedRevision !== snapshot.revision) throw new Error('O estado mudou. Atualize a página e tente novamente.');
    if (['STARTING', 'RECORDING', 'STOPPING'].includes(snapshot.status)) throw new Error('Finalize a captura antes de reprocessar notas salvas.');
    const count = await retryAnalysis(request.recordingId, request.type === 'PROBE_ANALYSIS' ? 'probe' : 'notes', request.type === 'RETRY_ANALYSIS' ? request.analysisModel : undefined);
    if (!count) {
      if (await getNotes(request.recordingId)) return snapshot;
      const jobs = await listJobs(request.recordingId);
      if (!jobs.some((job) => job.kind === 'ANALYZE_RECORDING' && !isTerminalJob(job))) throw new Error('Não há análise com falha recuperável e transcrição completa nesta sessão. Nenhum envio foi feito.');
    }
    const next = request.recordingId === snapshot.recordingId && snapshot.status === 'ERROR'
      ? await saveCaptureSnapshot({ ...snapshot, status: 'PROCESSING', failure: null, processingStage: 'preparing', revision: snapshot.revision + 1 }) : snapshot;
    await ensureOffscreen(true);
    return next;
  }
  if (request.expectedRevision !== snapshot.revision || request.recordingId !== snapshot.recordingId) throw new Error('O estado mudou. Atualize o popup e tente novamente.');
  if (request.type === 'RECOVER_CAPTURE') {
    if (snapshot.status !== 'ERROR' || snapshot.failure?.phase !== 'processing' || !snapshot.recordingId) throw new Error('Não há transcrição para retomar.');
    const count = await retryFailedTranscriptions(snapshot.recordingId) + await retryAnalysis(snapshot.recordingId);
    if (!count) throw new Error('Não há processamento com falha e dados completos para retomar. Consulte o diagnóstico da sessão.');
    const recovered = await saveCaptureSnapshot(advance(snapshot, { type: 'RECOVER_PROCESSING' }));
    await ensureOffscreen(true);
    return recovered;
  }
  if (request.type === 'RETRY_TRANSCRIPTION') {
    if (snapshot.status !== 'ERROR' || snapshot.failure?.phase !== 'processing' || !snapshot.recordingId) throw new Error('Não há transcrição para repetir.');
    await scheduleCleanupForFailedTranscriptions(snapshot.recordingId);
    if (!await retryOneHttp404(snapshot.recordingId, request.chunkId)) throw new Error('Esta parte não tem um HTTP 404 recuperável com áudio local preservado.');
    const recovered = await saveCaptureSnapshot(advance(snapshot, { type: 'RECOVER_PROCESSING' }));
    await ensureOffscreen(true);
    return recovered;
  }
  if (request.type === 'RESET_CAPTURE') {
    if (!['COMPLETED', 'ERROR'].includes(snapshot.status)) throw new Error('Finalize a gravação antes de iniciar outra.');
    if (snapshot.status === 'ERROR' && snapshot.failure?.phase === 'processing' && snapshot.recordingId && (await listJobs(snapshot.recordingId)).some((job) => job.kind !== 'DELETE_REMOTE_FILE' && !isTerminalJob(job))) throw new Error('Aguarde o processamento ativo antes de arquivar esta sessão.');
    if (snapshot.recordingId) await clearActiveRecording(snapshot.recordingId);
    return saveCaptureSnapshot({ ...initialSnapshot('capture'), revision: snapshot.revision + 1 });
  }
  if (request.type === 'START_CAPTURE') {
    if (snapshot.status !== 'IDLE') throw new Error('Já existe uma sessão.');
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined || !tab.url || /^(chrome|edge|chrome-extension):/.test(tab.url)) throw new Error('Abra uma aba de reunião ou vídeo antes de iniciar.');
    const recordingId = crypto.randomUUID();
    const starting = await saveCaptureSnapshot({ ...advance(snapshot, { type: 'START_REQUESTED' }), recordingId, targetTabId: tab.id, profile: request.payload.profile, startRequestedAt: Date.now() });
    try {
      const settings = await loadSettings(chrome.storage.local);
      await createRecording({ id: recordingId, createdAt: Date.now(), startedAt: null, endedAt: null, profile: request.payload.profile, analysisModel: settings.analysisModel, retention: settings.retention, status: 'STARTING', revision: 0, durationMs: 0, chunkCount: 0, completeness: 'UNKNOWN', interruption: null });
      await ensureOffscreen();
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      const reply = await askOffscreen({ type: 'START', recordingId, streamId });
      if (!reply.ok || reply.status?.state !== 'RECORDING') throw new Error(reply.message || 'As duas fontes não iniciaram.');
      const recording = await confirmCaptureStarted(recordingId, reply.status.startedAt ?? Date.now());
      if (recording.endedAt !== null) {
        const processing = await committedCapture(starting, recording);
        if (processing) return reconcileCapture(processing);
        await handleCaptureEvent({ event: 'CAPTURE_INTERRUPTED', recordingId, message: 'A fonte encerrou durante a preparação. Consulte os dados preservados.' });
        return readCaptureSnapshot();
      }
      return saveCaptureSnapshot({ ...advance(starting, { type: 'CAPTURE_READY' }), startedAt: reply.status.startedAt ?? Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar a gravação.';
      await saveCaptureSnapshot(advance(starting, { type: 'FAILURE', failure: failure(message.slice(0, 300)) }));
      const recording = await getRecording(recordingId).catch(() => undefined);
      if (recording) await updateRecording({ ...recording, status: 'ERROR', interruption: message, revision: recording.revision + 1 }).catch(() => undefined);
      await closeOffscreen().catch(() => undefined);
      throw error;
    }
  }
  if (request.type === 'STOP_CAPTURE') {
    if (snapshot.status !== 'RECORDING') throw new Error('Não há gravação ativa.');
    const stopping = await saveCaptureSnapshot(advance(snapshot, { type: 'STOP_REQUESTED' }));
    try {
      const reply = await askOffscreen({ type: 'STOP', recordingId: snapshot.recordingId });
      if (!reply.ok) throw new Error(reply.message || 'Não foi possível salvar o áudio.');
      const recording = snapshot.recordingId ? await getRecording(snapshot.recordingId) : undefined;
      const processing = recording && await committedCapture(stopping, recording);
      if (!processing) throw new Error('A integridade da gravação não foi comprovada. Consulte os dados preservados.');
      return reconcileCapture(processing);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível finalizar a gravação.';
      const chunks = snapshot.recordingId ? await listChunks(snapshot.recordingId).catch(() => []) : [];
      const failed = await saveCaptureSnapshot({ ...advance(stopping, { type: 'FAILURE', failure: failure(message.slice(0, 300), chunks.length > 0) }), interrupted: true });
      const jobs = snapshot.recordingId ? await listJobs(snapshot.recordingId).catch(() => []) : [];
      if (jobs.every(isTerminalJob)) await closeOffscreen().catch(() => undefined);
      return failed;
    }
  }
  return snapshot;
}
export async function handleCaptureEvent(event: { event: string; recordingId: string; message: string }): Promise<void> {
  const snapshot = await readCaptureSnapshot();
  if (snapshot.recordingId !== event.recordingId || !['STARTING', 'RECORDING', 'STOPPING'].includes(snapshot.status)) return;
  const recording = await getRecording(event.recordingId).catch(() => undefined);
  // A durable, verified source wins over late/lost notifications, including an
  // error while disposing media resources after its successful final commit.
  const processing = recording && await committedCapture(snapshot, recording);
  if (processing) { await reconcileCapture(processing); return; }
  const saved = event.event === 'CAPTURE_INTERRUPTED';
  const startedAt = snapshot.startedAt ?? recording?.startedAt ?? null;
  const endedAt = recording?.endedAt ?? (startedAt === null ? null : Math.max(Date.now(), startedAt));
  const chunks = await listChunks(event.recordingId).catch(() => []);
  if (recording && recording.endedAt === null) { await updateRecording({ ...recording, startedAt, status: saved ? 'INTERRUPTED' : 'ERROR', endedAt, chunkCount: chunks.length, durationMs: startedAt !== null && endedAt !== null ? endedAt - startedAt : 0, completeness: 'PARTIAL', interruption: event.message, revision: recording.revision + 1 }).catch(() => undefined); }
  await saveCaptureSnapshot({ ...snapshot, status: 'ERROR', startedAt, endedAt,
    interrupted: true, failure: failure(saved ? `${event.message} O áudio parcial está disponível para revisão.` : event.message, saved || chunks.length > 0), revision: snapshot.revision + 1 });
  const jobs = await listJobs(event.recordingId).catch(() => []);
  if (jobs.every(isTerminalJob)) await closeOffscreen().catch(() => undefined);
}
