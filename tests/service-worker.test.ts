import { afterEach, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_KEY } from '../src/background/foundation';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/storage/settings';
import type { Request, Response } from '../src/messaging/protocol';

type Listener = (raw: unknown, sender: { id: string; url: string }, sendResponse: (response: Response) => void) => boolean;
const extensionId = 'foundation-test';
const sender = { id: extensionId, url: `chrome-extension://${extensionId}/src/popup/popup.html` };
const requestId = '00000000-0000-4000-8000-000000000001';

async function boot(values: Record<string, unknown>) {
  vi.resetModules();
  let listener: Listener | undefined;
  const local = {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (input: Record<string, unknown>) => { Object.assign(values, input); }),
    setAccessLevel: vi.fn(async () => undefined),
  };
  vi.stubGlobal('chrome', { runtime: { id: extensionId, getURL: (path: string) => `chrome-extension://${extensionId}/${path}`,
    onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() },
    onMessage: { addListener: (callback: Listener) => { listener = callback; } },
  }, storage: { local, onChanged: { addListener: vi.fn() } } });
  await import('../src/background/service-worker');
  if (!listener) throw new Error('Listener não registrado no bootstrap.');
  const activeListener = listener;
  const send = (request: Request, origin = sender) => new Promise<Response>((resolve) => { activeListener(request, origin, resolve); });
  return { local, send, listener: activeListener };
}
afterEach(() => { vi.unstubAllGlobals(); });
describe('service worker with storage adapter (não valida lifecycle Edge)', () => {
  it('não entrega credencial ao popup', async () => {
    const values: Record<string, unknown> = { [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, apiKey: 'test-only-key' } };
    const app = await boot(values);
    const reply = vi.fn();
    expect(app.listener({ target: 'background-credentials', type: 'GET' }, sender, reply)).toBe(false);
    expect(reply).not.toHaveBeenCalled();
    expect(app.local.get).not.toHaveBeenCalled();
  });
  it('registra listener no bootstrap e recupera mock em nova instância sem vazar settings', async () => {
    const values: Record<string, unknown> = { [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, apiKey: 'example-not-a-secret' } };
    const first = await boot(values);
    const started = await first.send({ protocolVersion: 1, requestId, target: 'background', type: 'START_MOCK', recordingId: null, expectedRevision: 0, payload: { profile: 'development' } });
    expect(started.ok).toBe(true);
    expect(values[SNAPSHOT_KEY]).toBeDefined();
    const second = await boot(values);
    const snapshot = await second.send({ protocolVersion: 1, requestId, target: 'background', type: 'GET_SNAPSHOT' });
    expect(snapshot).toEqual(started);
    expect(JSON.stringify(snapshot)).not.toContain('example-not-a-secret');
    expect(second.local.get).not.toHaveBeenCalledWith(SETTINGS_KEY);
    expect(second.local.set).not.toHaveBeenCalled();
  });
  it('serializa comandos concorrentes e rejeita o segundo START desatualizado', async () => {
    const worker = await boot({});
    const request: Request = { protocolVersion: 1, requestId, target: 'background', type: 'START_MOCK', recordingId: null, expectedRevision: 0, payload: { profile: 'general' } };
    const responses = await Promise.all([worker.send(request), worker.send(request)]);
    expect(responses.filter((response) => response.ok)).toHaveLength(1);
    expect(responses.find((response) => !response.ok)).toMatchObject({ code: 'CONFLICT' });
  });
  it('rejeita sender externo sem ler armazenamento', async () => {
    const worker = await boot({});
    const response = await worker.send({ protocolVersion: 1, requestId, target: 'background', type: 'GET_SNAPSHOT' }, { id: extensionId, url: 'https://example.org/' });
    expect(response).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(worker.local.get).not.toHaveBeenCalled();
  });
  it('não consulta storage para mensagens malformadas', async () => {
    const worker = await boot({});
    const sendResponse = vi.fn();
    expect(worker.listener({ protocolVersion: 99 }, sender, sendResponse)).toBe(false);
    expect(worker.local.get).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });
  it('storage falho gera resposta sanitizada e não bloqueia próximo comando', async () => {
    const worker = await boot({});
    worker.local.get.mockRejectedValueOnce(new Error('example-not-a-secret'));
    const query: Request = { protocolVersion: 1, requestId, target: 'background', type: 'GET_SNAPSHOT' };
    const failed = await worker.send(query);
    expect(failed).toMatchObject({ ok: false, code: 'STORAGE_FAILURE' });
    expect(JSON.stringify(failed)).not.toContain('example-not-a-secret');
    expect((await worker.send(query)).ok).toBe(true);
  });
});
