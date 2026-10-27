import { afterEach, describe, expect, it, vi } from 'vitest';
import { canClaimJob, canRenewJobLease, isTerminalJob, JOB_LEASE_DURATION_MS, JOB_LEASE_RENEW_INTERVAL_MS, localChunkFailure, nextRetryAt, renewedLease } from '../src/queue/job-policy';
import { startLeaseHeartbeat } from '../src/queue/lease-heartbeat';
import type { Chunk, Job } from '../src/storage/recordings';

const job = (changes: Partial<Job> = {}): Job => ({ id: 'job', kind: 'TRANSCRIBE_CHUNK', recordingId: 'recording', chunkId: 'chunk', status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null, ...changes });
const chunk = (changes: Partial<Chunk> = {}): Chunk => ({ id: 'chunk', recordingId: 'recording', index: 1, recorderId: 'recorder', approximateStartMs: 0, approximateEndMs: 1000, measuredDurationMs: null, overlapMs: 0, mimeType: 'audio/webm;codecs=opus', blob: new Blob(['audio']), status: 'PENDING', attempts: 0, error: null, boundary: { configMode: 'test', requestedStartMs: 0, requestedEndMs: 1000, observedStartMs: 0, observedStopMs: 1000, interrupted: false, durationSource: 'clock', requestedBitrate: 128000, observedBitrate: 128000, sizeBytes: 5 }, ...changes });

describe('política de claim e erro', () => {
  it('renovação válida impede outro claim; sem heartbeat expira e generation antiga perde posse', () => {
    expect(JOB_LEASE_RENEW_INTERVAL_MS).toBeLessThan(JOB_LEASE_DURATION_MS / 2);
    const first = job({ status: 'PROCESSING', attempts: 1, leaseOwner: 'A', leaseExpiresAt: 60_000, generation: 1 });
    expect(canRenewJobLease(first, 'job', 'A', 1, 20_000)).toBe(true);
    expect(canRenewJobLease(first, 'job', 'B', 1, 20_000)).toBe(false);
    expect(canRenewJobLease(first, 'job', 'A', 0, 20_000)).toBe(false);
    const renewed = renewedLease(first, 20_000);
    expect(renewed.leaseExpiresAt).toBe(80_000);
    expect(canClaimJob(renewed, 61_000)).toBe(false);
    expect(canClaimJob(first, 61_000)).toBe(true);
    const second = { ...first, leaseOwner: 'B', leaseExpiresAt: 121_000, generation: 2 };
    expect(canRenewJobLease(second, 'job', 'A', 1, 61_001)).toBe(false);
    expect(canRenewJobLease(second, 'job', 'B', 2, 61_001)).toBe(true);
    expect(canRenewJobLease(job({ ...second, status: 'COMPLETE' }), 'job', 'B', 2, 61_001)).toBe(false);
    expect(canRenewJobLease(job({ ...second, status: 'ERROR' }), 'job', 'B', 2, 61_001)).toBe(false);
  });
  it('erro transitório respeita backoff e máximo de tentativas; permanente não volta à fila', () => {
    const retryable = { kind: 'RETRYABLE' as const, message: 'Falha temporária' };
    const next = nextRetryAt(job({ attempts: 1 }), 1000, retryable);
    expect(canClaimJob(job({ status: 'ERROR', attempts: 1, errorKind: 'RETRYABLE', nextAttemptAt: next }), next - 1)).toBe(false);
    expect(canClaimJob(job({ status: 'ERROR', attempts: 1, errorKind: 'RETRYABLE', nextAttemptAt: next }), next)).toBe(true);
    expect(canClaimJob(job({ status: 'ERROR', attempts: 5, errorKind: 'RETRYABLE', nextAttemptAt: next }), next)).toBe(false);
    expect(nextRetryAt(job(), 1000, { kind: 'PERMANENT', message: 'Inválido' })).toBe(0);
    expect(canClaimJob(job({ status: 'ERROR', errorKind: 'PERMANENT' }), 1_000_000)).toBe(false);
    expect(isTerminalJob(job({ status: 'ERROR', errorKind: 'PERMANENT' }))).toBe(true);
    expect(isTerminalJob(job({ status: 'ERROR', errorKind: 'RETRYABLE', attempts: 1 }))).toBe(false);
  });
  it('classifica vazio, MIME inválido, chunk incompatível e falha de leitura', () => {
    expect(localChunkFailure(chunk({ blob: new Blob() }))?.kind).toBe('PERMANENT');
    expect(localChunkFailure(chunk({ mimeType: 'audio/ogg' }))?.kind).toBe('PERMANENT');
    const incompatible = chunk({ status: 'ERROR', error: 'Duração acima do limite.' });
    expect(localChunkFailure(incompatible)?.kind).toBe('PERMANENT');
    expect(incompatible.blob.size).toBeGreaterThan(0);
    expect(localChunkFailure(undefined)?.kind).toBe('PERMANENT');
    expect(localChunkFailure(chunk())).toBeNull();
  });
});

afterEach(() => vi.useRealTimers());
describe('heartbeat do executor', () => {
  it('renova periodicamente e para em sucesso sem timer órfão', async () => {
    vi.useFakeTimers(); const renew = vi.fn(async () => true);
    const heartbeat = startLeaseHeartbeat(renew, 20);
    await vi.advanceTimersByTimeAsync(65);
    expect(renew).toHaveBeenCalledTimes(3);
    await heartbeat.stop(); await vi.advanceTimersByTimeAsync(100);
    expect(renew).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('para em falha, abort e shutdown', async () => {
    vi.useFakeTimers(); const renew = vi.fn(async () => false);
    const heartbeat = startLeaseHeartbeat(renew, 20);
    await vi.advanceTimersByTimeAsync(20);
    expect(heartbeat.signal.aborted).toBe(true);
    await heartbeat.stop(true); await vi.advanceTimersByTimeAsync(100);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('erro na renovação aborta e remove o timer', async () => {
    vi.useFakeTimers(); const renew = vi.fn(async () => { throw new Error('IDB indisponível'); });
    const heartbeat = startLeaseHeartbeat(renew, 20);
    await vi.advanceTimersByTimeAsync(20);
    expect(heartbeat.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await heartbeat.stop(); await vi.advanceTimersByTimeAsync(100);
    expect(renew).toHaveBeenCalledTimes(1);
  });
  it('aguarda renovação em voo antes de permitir settle', async () => {
    vi.useFakeTimers(); let release!: (valid: boolean) => void;
    const renew = vi.fn(() => new Promise<boolean>((resolve) => { release = resolve; }));
    const heartbeat = startLeaseHeartbeat(renew, 20);
    await vi.advanceTimersByTimeAsync(20);
    let stopped = false; const stopping = heartbeat.stop().then(() => { stopped = true; });
    expect(stopped).toBe(false); release(true); await stopping;
    expect(stopped).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
});
