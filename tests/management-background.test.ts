import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initialSnapshot } from '../src/domain/contracts';
import { SNAPSHOT_KEY } from '../src/background/foundation';
import { handleManagementRequest } from '../src/background/meeting-management';
import { reconcileCapture } from '../src/background/capture-coordinator';
import { createRecording, DB_NAME, getRecording, listJobs, openDatabase } from '../src/storage/recordings';
import { transactionDone } from '../src/storage/meeting-management';
import { analysisRecording } from './fixtures/notes';
import type { ManagementRequest, ManagementResponse } from '../src/messaging/management-protocol';

const id = '00000000-0000-4000-8000-000000000001';
const command: ManagementRequest = { protocolVersion: 1, target: 'background-management', requestId: id, recordingId: id, expectedRevision: 3, type: 'DELETE_RECORDING' };
let state: Record<string, unknown>;
let storage: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; setAccessLevel: ReturnType<typeof vi.fn> };
beforeEach(async () => {
  await new Promise<void>(resolve => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = () => resolve(); });
  state = { [SNAPSHOT_KEY]: { ...initialSnapshot('capture'), recordingId: id, status: 'COMPLETED', startedAt: 1000, endedAt: 2000, revision: 3 } };
  storage = { get: vi.fn(async key => ({ [key]: state[key] })), set: vi.fn(async values => { Object.assign(state, values); }), setAccessLevel: vi.fn(async () => undefined) };
  vi.stubGlobal('chrome', { runtime: { id: 'test', getURL: (path: string) => `chrome-extension://test/${path}`, getContexts: vi.fn(async () => []), onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} } }, storage: { local: storage, onChanged: { addListener() {} } } });
  await createRecording({ ...analysisRecording(), id, status: 'COMPLETED' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('rejeita revisão vencida sem alterar reunião', async () => {
  expect(await handleManagementRequest({ ...command, expectedRevision: 2 })).toMatchObject({ ok: false, code: 'CONFLICT' });
  expect(await getRecording(id)).toBeDefined();
});
it('protege snapshot em captura/processamento mesmo se os metadados salvos estiverem atrasados', async () => {
  state[SNAPSHOT_KEY] = { ...(state[SNAPSHOT_KEY] as object), status: 'PROCESSING' };
  expect(await handleManagementRequest(command)).toMatchObject({ ok: false, code: 'PROTECTED' }); expect(await getRecording(id)).toBeDefined();
});
it('reseta somente o snapshot da reunião excluída e repara um crash após o commit IDB', async () => {
  const before = state[SNAPSHOT_KEY] as Parameters<typeof reconcileCapture>[0]; storage.set.mockRejectedValueOnce(new Error('fixture interruption'));
  expect(await handleManagementRequest(command)).toMatchObject({ ok: true, result: { type: 'DELETE_RECORDING' } });
  expect(await getRecording(id)).toBeUndefined(); expect(state[SNAPSHOT_KEY]).toEqual(before);
  expect(await reconcileCapture(before)).toMatchObject({ status: 'IDLE', recordingId: null, revision: 4 });
});
it('excluir reunião antiga não muda o snapshot de outra reunião', async () => {
  const other = { ...initialSnapshot('capture'), revision: 3 }; state[SNAPSHOT_KEY] = other;
  expect(await handleManagementRequest(command)).toMatchObject({ ok: true }); expect(state[SNAPSHOT_KEY]).toEqual(other); expect(storage.set).not.toHaveBeenCalled();
});
it('listener valida sender e mensagem antes de qualquer leitura e serializa duas exclusões', async () => {
  type Listener = (raw: unknown, sender: { id: string; url: string }, callback: (reply: ManagementResponse) => void) => boolean;
  let listener: Listener | undefined;
  chrome.runtime.onMessage.addListener = vi.fn(callback => { listener = callback as unknown as Listener; });
  vi.resetModules(); await import('../src/background/service-worker');
  const reply = vi.fn();
  expect(listener!(command, { id: 'test', url: 'https://example.org/' }, reply)).toBe(false); expect(reply).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' })); expect(storage.get).not.toHaveBeenCalled();
  expect(listener!({ ...command, recordingId: '*' }, { id: 'test', url: 'chrome-extension://test/src/library/library.html' }, reply)).toBe(false); expect(storage.get).not.toHaveBeenCalled();
  const send = () => new Promise<ManagementResponse>(resolve => { listener!(command, { id: 'test', url: 'chrome-extension://test/src/library/library.html' }, resolve); });
  const results = await Promise.all([send(), send()]);
  expect(results.filter(result => result.ok)).toHaveLength(1); expect(results.find(result => !result.ok)).toMatchObject({ code: 'CONFLICT' });
});

it.each(['IDLE', 'ERROR'] as const)('salvar credencial desperta limpeza de reunião excluída com snapshot %s', async status => {
  const deletedId = '00000000-0000-4000-8000-000000000002';
  state[SNAPSHOT_KEY] = status === 'IDLE' ? { ...initialSnapshot('capture'), revision: 3 } : { ...initialSnapshot('capture'), revision: 3, status: 'ERROR', recordingId: deletedId, startedAt: 1000, endedAt: 2000, failure: { phase: 'processing', recoverable: true, hasRecoverableData: true, message: 'fixture interrupted reset' } };
  const database = await openDatabase(); const tx = database.transaction(['meetingDeletions', 'jobs'], 'readwrite'); const done = transactionDone(tx);
  tx.objectStore('meetingDeletions').put({ recordingId: deletedId, deletedAt: Date.now() });
  tx.objectStore('jobs').put({ id: 'deleted-cleanup', kind: 'DELETE_REMOTE_FILE', recordingId: deletedId, chunkId: 'deleted-chunk', status: 'WAITING_FOR_CREDENTIALS', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: 'USER_ACTION_REQUIRED', remoteFile: { name: 'files/fixture', uri: '', mimeType: 'audio/webm' } });
  await done; database.close();
  type Changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
  let changed: Changed | undefined;
  chrome.storage.onChanged.addListener = vi.fn(callback => { changed = callback; });
  const createDocument = vi.fn(async () => undefined); Object.assign(chrome, { offscreen: { createDocument } });
  vi.resetModules(); await import('../src/background/service-worker');
  changed!({ 'settings-v1': { oldValue: { apiKey: '' }, newValue: { apiKey: 'fixture-not-a-real-key' } } }, 'local');
  await vi.waitFor(() => expect(createDocument).toHaveBeenCalledOnce());
  expect((await listJobs(deletedId))[0]?.status).toBe('PENDING'); expect(await getRecording(deletedId)).toBeUndefined();
  expect(state[SNAPSHOT_KEY]).toMatchObject({ status: 'IDLE', recordingId: null });
});
