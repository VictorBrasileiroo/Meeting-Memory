import { describe, expect, it } from 'vitest';
import { applyRequest, reconcileSnapshot } from '../src/background/foundation';
import { initialSnapshot, type Snapshot } from '../src/domain/contracts';
import type { Request } from '../src/messaging/protocol';

const id = '00000000-0000-4000-8000-000000000001';
function request(snapshot: Snapshot, type: Extract<Request['type'], `${string}_MOCK`>): Extract<Request, { type: `${string}_MOCK` }> {
  const base = { protocolVersion: 1 as const, requestId: id, target: 'background' as const, recordingId: snapshot.recordingId, expectedRevision: snapshot.revision };
  return type === 'START_MOCK' ? { ...base, type, payload: { profile: 'research' } } : { ...base, type };
}
describe('mock foundation coordinator', () => {
  it('build normal nunca aceita comando mock e ignora snapshot simulado antigo', () => {
    const initial = initialSnapshot();
    expect(() => applyRequest(initial, request(initial, 'START_MOCK'), false, 100, id)).toThrow('indisponível');
    expect(reconcileSnapshot(initialSnapshot('mock'), false)).toEqual(initial);
  });
  it('reconstitui snapshot validado com timer e perfil após restart', () => {
    let snapshot = initialSnapshot('mock');
    snapshot = applyRequest(snapshot, request(snapshot, 'START_MOCK'), true, 100, id);
    snapshot = applyRequest(snapshot, request(snapshot, 'ADVANCE_MOCK'), true, 200, id);
    const restarted = reconcileSnapshot(JSON.parse(JSON.stringify(snapshot)), true);
    expect(restarted).toEqual(snapshot);
    expect(restarted.startedAt).toBe(200);
    expect(restarted.profile).toBe('research');
    snapshot = applyRequest(restarted, request(restarted, 'STOP_MOCK'), true, 400, id);
    snapshot = applyRequest(snapshot, request(snapshot, 'ADVANCE_MOCK'), true, 500, id);
    expect(snapshot.endedAt).toBe(500);
    snapshot = applyRequest(snapshot, request(snapshot, 'FAIL_MOCK'), true, 600, id);
    snapshot = applyRequest(snapshot, request(snapshot, 'RECOVER_MOCK'), true, 700, id);
    snapshot = applyRequest(snapshot, request(snapshot, 'ADVANCE_MOCK'), true, 800, id);
    expect(snapshot.status).toBe('COMPLETED');
    expect(snapshot.endedAt).toBe(500);
  });
  it('bloqueia revisão ou sessão desatualizada', () => {
    const snapshot = initialSnapshot('mock');
    const stale = request(snapshot, 'START_MOCK');
    const started = applyRequest(snapshot, stale, true, 100, id);
    expect(() => applyRequest(started, stale, true, 100, id)).toThrow('outra janela');
    expect(() => applyRequest(started, { ...request(started, 'STOP_MOCK'), recordingId: null }, true, 100, id)).toThrow('outra janela');
  });
  it('snapshot corrompido nunca aparece como gravação válida', () => {
    expect(reconcileSnapshot({ mode: 'mock', status: 'RECORDING' }, true)).toEqual(initialSnapshot('mock'));
  });
});
