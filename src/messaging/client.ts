import { applyRequest } from '../background/foundation';
import { initialSnapshot, type Snapshot } from '../domain/contracts';
import { PROTOCOL_VERSION, requestSchema, responseSchema, type Request } from './protocol';

export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}
// Prévia Vite, somente desenvolvimento. Não persiste credenciais ou dados falsos.
let previewSnapshot = initialSnapshot('mock');
export async function sendRequest(request: Request): Promise<Snapshot> {
  requestSchema.parse(request);
  if (!isExtensionContext()) {
    if (!__FOUNDATION_MOCK__) throw new Error('Abra esta página dentro da extensão instalada no Edge.');
    previewSnapshot = applyRequest(previewSnapshot, request, true, Date.now(), crypto.randomUUID());
    return previewSnapshot;
  }
  let raw: unknown;
  try { raw = await chrome.runtime.sendMessage(request); }
  catch { throw new Error('Não foi possível conversar com a extensão. Reabra o popup ou recarregue a extensão.'); }
  const response = responseSchema.safeParse(raw);
  if (!response.success || response.data.requestId !== request.requestId) throw new Error('A extensão retornou uma resposta inesperada.');
  if (!response.data.ok) throw new Error(response.data.message);
  return response.data.snapshot;
}
export function getSnapshot(): Promise<Snapshot> {
  return sendRequest({ protocolVersion: PROTOCOL_VERSION, requestId: crypto.randomUUID(), target: 'background', type: 'GET_SNAPSHOT' });
}
export function openSettings(): void {
  if (isExtensionContext()) void chrome.runtime.openOptionsPage();
  else window.location.assign('../settings/settings.html');
}
export function openSession(): void {
  if (isExtensionContext()) void chrome.tabs.create({ url: chrome.runtime.getURL('src/session/session.html') });
  else window.location.assign('../session/session.html');
}
export function openReview(recordingId?: string): void {
  const query = recordingId ? `?recordingId=${encodeURIComponent(recordingId)}` : '';
  if (isExtensionContext()) void chrome.tabs.create({ url: chrome.runtime.getURL(`src/review/review.html${query}`) });
  else window.location.assign(`../review/review.html${query}`);
}
export function openMicrophonePermission(): void {
  if (isExtensionContext()) void chrome.tabs.create({ url: chrome.runtime.getURL('src/microphone/microphone.html') });
  else window.location.assign('../microphone/microphone.html');
}
