import { CaptureSession } from '../capture/capture-session';
import { getActiveRecordingId } from '../storage/recordings';

export const OFFSCREEN_PATH = 'src/offscreen/offscreen.html';
const capture = new CaptureSession();
let lastRecordingId = '';
void getActiveRecordingId().then((id) => { if (id) lastRecordingId = id; }).catch(() => undefined);
const executor = new Worker(new URL('../queue/local-worker.ts', import.meta.url), { type: 'module' });
async function refreshCredential(): Promise<void> {
  try { const settings = await chrome.runtime.sendMessage({ target: 'background-credentials', type: 'GET' }) as { apiKey: string }; executor.postMessage({ type: 'CREDENTIAL', apiKey: settings.apiKey }); }
  catch { executor.postMessage({ type: 'CREDENTIAL', apiKey: '' }); }
}
void refreshCredential();
window.addEventListener('pagehide', () => executor.postMessage({ type: 'SHUTDOWN' }));
executor.onmessage = (event: MessageEvent<{ type: string; recordingId?: string }>) => {
  if (event.data.type === 'DRAINED') void chrome.runtime.sendMessage({ target: 'background-capture', event: 'JOBS_DRAINED', recordingId: event.data.recordingId || capture.status().recordingId || lastRecordingId, message: '' }).catch(() => undefined);
};
chrome.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !raw || typeof raw !== 'object') return false;
  const message = raw as Record<string, unknown>;
  if (message.target !== 'offscreen-capture') return false;
  if (message.type === 'REFRESH_CREDENTIAL') { void refreshCredential(); respond({ ok: true }); return false; }
  if (message.type === 'STATUS') { respond({ ok: true, status: capture.status() }); return false; }
  if (message.type === 'ENABLE_TEST_TRANSCRIPTION' && __CHUNK_TEST__ && sender.url === chrome.runtime.getURL('src/session/session.html')) { executor.postMessage({ type: 'ENABLE_TEST_TRANSCRIPTION' }); respond({ ok: true }); return false; }
  if (message.type === 'LEVELS' && typeof message.recordingId === 'string') {
    respond({ ok: true, levels: capture.levels(message.recordingId) });
    return false;
  }
  if (message.type === 'INTERRUPT' && typeof message.message === 'string' && message.recordingId === capture.status().recordingId) {
    capture.interrupt(message.message);
    respond({ ok: true });
    return false;
  }
  if (message.type === 'START' && typeof message.recordingId === 'string' && typeof message.streamId === 'string') {
    lastRecordingId = message.recordingId;
    void capture.start(message.recordingId, message.streamId).then((status) => respond({ ok: true, status }))
      .catch((error: unknown) => respond({ ok: false, message: error instanceof Error ? error.message : 'Não foi possível iniciar a captura.' }));
    return true;
  }
  if ((message.type === 'STOP' || message.type === 'TAB_CLOSED') && typeof message.recordingId === 'string') {
    if ((capture.status().recordingId ?? lastRecordingId) !== message.recordingId) { respond({ ok: false, message: 'A sessão ativa não corresponde ao pedido.' }); return false; }
    void (message.type === 'TAB_CLOSED' ? capture.closeTab() : capture.stop()).then((result) => { executor.postMessage({ type: 'WAKE' }); respond({ ok: !result.interrupted, result }); })
      .catch((error: unknown) => respond({ ok: false, message: error instanceof Error ? error.message : 'Não foi possível finalizar a gravação.' }));
    return true;
  }
  return false;
});
