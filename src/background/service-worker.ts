import { managementRequestSchema, isTrustedManager, type ManagementResponse } from '../messaging/management-protocol';
import { handleManagementRequest } from './meeting-management';
import { applyRequest, FoundationError, reconcileSnapshot, SNAPSHOT_KEY } from './foundation';
import { requestSchema, isTrustedPage, type Response } from '../messaging/protocol';
import { InvalidTransitionError } from '../domain/recording-state';
import { loadSettings, restrictSettingsAccess } from '../storage/settings';
import { closeOffscreen, ensureOffscreen, handleCaptureEvent, handleCaptureRequest, handleTabCaptureEnded, offscreenExists, readCaptureSnapshot, reconcileCapture, saveCaptureSnapshot } from './capture-coordinator';
import { listAllJobs, listJobs, resumeCredentialJobs } from '../storage/recordings';
import { isTerminalJob } from '../queue/job-policy';
import { initialSnapshot } from '../domain/contracts';
import { wasRecordingDeleted } from '../storage/recordings';
import { confirmCapturedTabClosed, noteRemovedTab } from './capture-coordinator';

// Somente serialização temporária; o snapshot sempre é relido do storage.
let pending: Promise<void> = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => { void restrictSettingsAccess(chrome.storage.local); });
chrome.runtime.onStartup.addListener(() => { void restrictSettingsAccess(chrome.storage.local); });
chrome.storage.onChanged.addListener((changes, area) => {
  const settingsChange = changes['settings-v1'];
  if (area !== 'local' || !settingsChange) return;
  pending = pending.then(async () => {
    const next = settingsChange.newValue as { apiKey?: unknown } | undefined;
    if (typeof next?.apiKey !== 'string' || !next.apiKey) return;
    const previous = settingsChange.oldValue as { apiKey?: unknown } | undefined;
    if (previous?.apiKey === next.apiKey) return;
    await resumeCredentialJobs(true);
    let snapshot = await readCaptureSnapshot();
    if (snapshot.recordingId && await wasRecordingDeleted(snapshot.recordingId)) snapshot = await saveCaptureSnapshot({ ...initialSnapshot('capture'), revision: snapshot.revision + 1 });
    if (snapshot.status === 'ERROR' && snapshot.failure?.phase === 'processing' && snapshot.failure.recoverable) {
      await saveCaptureSnapshot({ ...snapshot, status: 'PROCESSING', failure: null, revision: snapshot.revision + 1 });
      await ensureOffscreen(true);
    } else if (snapshot.status === 'PROCESSING') await ensureOffscreen(true);
    if ((await listAllJobs()).some(job => job.kind === 'DELETE_REMOTE_FILE' && !isTerminalJob(job))) await ensureOffscreen(true);
    if (await offscreenExists()) await chrome.runtime.sendMessage({ target: 'offscreen-capture', type: 'REFRESH_CREDENTIAL' }).catch(() => undefined);
  }).catch(() => undefined);
});
chrome.tabs?.onRemoved?.addListener(tabId => {
  noteRemovedTab(tabId); // Remember the fact before commands waiting for STOP.
  pending = pending.then(() => handleTabCaptureEnded(tabId, 'closed')).catch(() => undefined);
});
chrome.tabCapture?.onStatusChanged?.addListener((info) => {
  if (info.status !== 'stopped' && info.status !== 'error') return;
  pending = pending.then(() => handleTabCaptureEnded(info.tabId, info.status === 'error' ? 'error' : 'stopped')).catch(() => undefined);
});
chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  // Independent of the command queue: a STOP can be waiting for this answer.
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).target === 'background-capture-source') {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('src/offscreen/offscreen.html')) return false;
    const id = (raw as Record<string, unknown>).recordingId;
    void readCaptureSnapshot().then(async snapshot => {
      if (snapshot.recordingId !== id || snapshot.targetTabId == null) return { closed: false };
      return { closed: await confirmCapturedTabClosed(snapshot.targetTabId) };
    }).then(sendResponse).catch(() => sendResponse({ closed: false }));
    return true;
  }
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).target === 'background-credentials') {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('src/offscreen/offscreen.html')) return false;
    void loadSettings(chrome.storage.local).then((settings) => sendResponse({ apiKey: settings.apiKey }))
      .catch(() => sendResponse({ apiKey: '' }));
    return true;
  }
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).target === 'background-capture') {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('src/offscreen/offscreen.html')) return false;
    const event = raw as { event: string; recordingId: string; message: string };
    if (!['CAPTURE_INTERRUPTED', 'CAPTURE_FAILED', 'CAPTURE_AUTO_STOPPED', 'JOBS_DRAINED'].includes(event.event) || typeof event.recordingId !== 'string' || typeof event.message !== 'string') return false;
    pending = pending.then(async () => {
      if (event.event === 'JOBS_DRAINED') { const snapshot = await readCaptureSnapshot(); if (snapshot.status === 'PROCESSING' || (snapshot.status === 'ERROR' && snapshot.failure?.phase === 'processing')) await reconcileCapture(snapshot); else if (snapshot.recordingId && ['COMPLETED', 'ERROR'].includes(snapshot.status)) { const jobs = await listJobs(snapshot.recordingId); if (jobs.every(isTerminalJob)) await closeOffscreen(); } else if (snapshot.status === 'IDLE') await closeOffscreen(); }
      else await handleCaptureEvent(event);
    }).catch(() => undefined);
    sendResponse({ ok: true });
    return false;
  }
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).target === 'background-management') {
    const parsed = managementRequestSchema.safeParse(raw);
    if (!parsed.success) return false;
    const request = parsed.data;
    const fail = (code: Extract<ManagementResponse, { ok: false }>['code'], message: string) => sendResponse({ protocolVersion: 1, requestId: request.requestId, ok: false, code, message } satisfies ManagementResponse);
    if (!isTrustedManager(sender, chrome.runtime.id)) { fail('FORBIDDEN', 'Esta página não pode gerenciar as reuniões.'); return false; }
    pending = pending.then(async () => {
      try {
        if (await restrictSettingsAccess(chrome.storage.local) === 'failed') { fail('STORAGE_FAILURE', 'Não foi possível proteger o armazenamento local.'); return; }
        sendResponse(await handleManagementRequest(request));
      } catch { fail('STORAGE_FAILURE', 'Não foi possível concluir a operação. Atualize a lista para conferir o resultado.'); }
    });
    return true;
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return false;
  const request = parsed.data;
  const failure = (code: Extract<Response, { ok: false }>['code'], message: string): Response => ({
    protocolVersion: 1, requestId: request.requestId, ok: false, code, message,
  });
  if (!isTrustedPage(sender, chrome.runtime.id)) {
    sendResponse(failure('FORBIDDEN', 'Esta página não pode controlar a extensão.'));
    return false;
  }
  pending = pending.then(async () => {
    const isMock = request.type.endsWith('_MOCK') || (__FOUNDATION_MOCK__ && request.type === 'GET_SNAPSHOT');
    try {
      const access = await restrictSettingsAccess(chrome.storage.local);
      if (access === 'failed') { sendResponse(failure('STORAGE_FAILURE', 'Não foi possível restringir o acesso às configurações locais.')); return; }
      const snapshot = isMock ? reconcileSnapshot((await chrome.storage.local.get(SNAPSHOT_KEY))[SNAPSHOT_KEY], __FOUNDATION_MOCK__) : await readCaptureSnapshot();
      const next = isMock ? applyRequest(snapshot, request, __FOUNDATION_MOCK__, Date.now(), crypto.randomUUID()) : await handleCaptureRequest(request, snapshot);
      // Chave de configuração e credencial nunca fazem parte do snapshot/resposta.
      if (isMock && __FOUNDATION_MOCK__ && request.type !== 'GET_SNAPSHOT') await chrome.storage.local.set({ [SNAPSHOT_KEY]: next });
      sendResponse({ protocolVersion: 1, requestId: request.requestId, ok: true, snapshot: next } satisfies Response);
    } catch (error) {
      if (error instanceof FoundationError) sendResponse(failure(error.code, error.message));
      else if (error instanceof InvalidTransitionError) sendResponse(failure('INVALID_TRANSITION', 'Esta ação não está disponível no estado atual.'));
      else if (isMock) sendResponse(failure('STORAGE_FAILURE', 'Não foi possível ler ou salvar o estado local. Reabra a extensão e tente novamente.'));
      else sendResponse(failure('CAPTURE_FAILURE', error instanceof Error ? error.message.slice(0, 300) : 'Não foi possível concluir a ação.'));
    }
  });
  return true;
});
