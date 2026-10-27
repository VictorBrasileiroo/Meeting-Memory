import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialSnapshot } from '../src/domain/contracts';
import { ensureOffscreen, handleCaptureRequest, reconcileCapture } from '../src/background/capture-coordinator';

const id = '00000000-0000-4000-8000-000000000001';
afterEach(() => vi.unstubAllGlobals());
function browser(live: { recordingId: string | null; state: string; startedAt: number | null } | null) {
  const set = vi.fn(async () => undefined);
  const getContexts = vi.fn(async () => live ? [{ contextType: 'OFFSCREEN_DOCUMENT' }] : []);
  const createDocument = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}`, getContexts,
    sendMessage: vi.fn(async () => ({ ok: true, status: live })) }, offscreen: { createDocument }, storage: { local: { set } } });
  return { set, getContexts, createDocument };
}
describe('reconciliação do worker', () => {
  it('não duplica offscreen em criação concorrente', async () => {
    const api = browser(null);
    await Promise.all([ensureOffscreen(), ensureOffscreen()]);
    expect(api.createDocument).toHaveBeenCalledOnce();
  });
  it('preserva RECORDING vivo depois de restart sem criar nova captura', async () => {
    const api = browser({ recordingId: id, state: 'RECORDING', startedAt: 100 });
    const snapshot = { ...initialSnapshot('capture'), recordingId: id, status: 'RECORDING' as const, startedAt: 100, revision: 2 };
    expect(await reconcileCapture(snapshot)).toEqual(snapshot);
    expect(api.set).not.toHaveBeenCalled();
    expect(api.createDocument).not.toHaveBeenCalled();
  });
  it('não declara falha enquanto STARTING ainda está adquirindo as fontes', async () => {
    browser(null);
    const snapshot = { ...initialSnapshot('capture'), recordingId: id, status: 'STARTING' as const, startRequestedAt: Date.now(), revision: 1 };
    expect(await reconcileCapture(snapshot)).toEqual(snapshot);
  });
  it('indica interrupção se a captura viva desapareceu', async () => {
    const api = browser(null);
    const snapshot = { ...initialSnapshot('capture'), recordingId: id, status: 'RECORDING' as const, startedAt: 100, revision: 2 };
    const result = await reconcileCapture(snapshot);
    expect(result.status).toBe('ERROR');
    expect(result.interrupted).toBe(true);
    expect(api.set).toHaveBeenCalledOnce();
  });
  it('STOP repetido após commit retorna a mesma sessão sem acionar o recorder', async () => {
    const api = browser(null);
    const snapshot = { ...initialSnapshot('capture'), recordingId: id, status: 'COMPLETED' as const, startedAt: 100, endedAt: 200, revision: 4 };
    const reply = await handleCaptureRequest({ protocolVersion: 1, requestId: id, target: 'background', type: 'STOP_CAPTURE', recordingId: id, expectedRevision: 3 }, snapshot);
    expect(reply).toEqual(snapshot);
    expect(api.set).not.toHaveBeenCalled();
  });
  it('permite nova gravação após COMPLETED, com revisão nova', async () => {
    const api = browser(null);
    const snapshot = { ...initialSnapshot('capture'), recordingId: id, status: 'COMPLETED' as const, startedAt: 100, endedAt: 200, revision: 4 };
    const reply = await handleCaptureRequest({ protocolVersion: 1, requestId: id, target: 'background', type: 'RESET_CAPTURE', recordingId: id, expectedRevision: 4 }, snapshot);
    expect(reply).toMatchObject({ status: 'IDLE', recordingId: null, revision: 5 });
    expect(api.set).toHaveBeenCalledOnce();
  });
});
