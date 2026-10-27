import { afterEach, expect, it, vi } from 'vitest';
import { initialSnapshot } from '../src/domain/contracts';

const calls = vi.hoisted(() => ({ ended: vi.fn(), request: vi.fn(), closed: vi.fn() }));
vi.mock('../src/background/capture-coordinator', async original => ({ ...await original<typeof import('../src/background/capture-coordinator')>(),
  handleTabCaptureEnded: calls.ended, handleCaptureRequest: calls.request,
  confirmCapturedTabClosed: calls.closed,
  readCaptureSnapshot: async () => ({ ...initialSnapshot('capture'), recordingId: '00000000-0000-4000-8000-000000000007', targetTabId: 7, status: 'RECORDING', startedAt: 1000 }),
}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
it('registra onRemoved no bootstrap, serializa com STOP e consulta ended sem deadlock na fila', async () => {
  vi.resetModules(); let removed!: (id: number) => void;
  let status!: (event: { tabId: number; status: string }) => void;
  let message!: (raw: unknown, sender: { id: string; url: string }, respond: (value: unknown) => void) => boolean;
  const id = '00000000-0000-4000-8000-000000000007';
  const order: string[] = []; let finish!: () => void;
  calls.request.mockImplementation(async () => { order.push('stop'); await new Promise<void>(resolve => { finish = resolve; }); order.push('saved'); return initialSnapshot('capture'); });
  calls.ended.mockImplementation(async (id, reason) => { order.push(`${id}:${reason}`); }); calls.closed.mockResolvedValue(true);
  vi.stubGlobal('chrome', { tabs: { onRemoved: { addListener: (cb: typeof removed) => { removed = cb; } } },
    tabCapture: { onStatusChanged: { addListener: (cb: typeof status) => { status = cb; } } },
    runtime: { id: 'test', getURL: (path: string) => `chrome-extension://test/${path}`, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener: (cb: typeof message) => { message = cb; } } },
    storage: { local: { setAccessLevel: async () => undefined }, onChanged: { addListener() {} } } });
  await import('../src/background/service-worker');
  const response = vi.fn();
  message({ protocolVersion: 1, requestId: id, target: 'background', type: 'STOP_CAPTURE', recordingId: id, expectedRevision: 2 }, { id: 'test', url: 'chrome-extension://test/src/popup/popup.html' }, response);
  await vi.waitFor(() => expect(order).toEqual(['stop']));
  removed(7); status({ tabId: 7, status: 'stopped' }); status({ tabId: 8, status: 'error' });
  const closed = vi.fn();
  expect(message({ target: 'background-capture-source', recordingId: id }, { id: 'test', url: 'chrome-extension://test/src/offscreen/offscreen.html' }, closed)).toBe(true);
  await vi.waitFor(() => expect(closed).toHaveBeenCalledWith({ closed: true }));
  expect(order).toEqual(['stop']); finish();
  await vi.waitFor(() => expect(order).toEqual(['stop', 'saved', '7:closed', '7:stopped', '8:error']));
  expect(response).toHaveBeenCalledOnce();
  const forbidden = vi.fn();
  expect(message({ target: 'background-capture-source', recordingId: id }, { id: 'test', url: 'chrome-extension://test/src/popup/popup.html' }, forbidden)).toBe(false);
  expect(forbidden).not.toHaveBeenCalled();
});
