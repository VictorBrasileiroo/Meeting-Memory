import type { Chunk, Job } from '../storage/recordings';
import type { AnalysisDiagnostic } from '../domain/analysis-diagnostic';
import { analysisProbeStages } from '../domain/analysis-probe';

export const JOB_LEASE_DURATION_MS = 60_000;
export const JOB_LEASE_RENEW_INTERVAL_MS = 20_000;
export const JOB_MAX_ATTEMPTS = 5;
export type JobFailure = { kind: 'RETRYABLE' | 'PERMANENT' | 'USER_ACTION_REQUIRED'; message: string; retryAfterMs?: number; rateLimited?: boolean; analysisDiagnostic?: AnalysisDiagnostic };

export function canClaimJob(job: Job, now: number): boolean {
  return job.attempts < (job.analysisProbe && !job.analysisProbe.done ? analysisProbeStages(job.analysisProbe).length : JOB_MAX_ATTEMPTS)
    && (job.status === 'PENDING' || job.status === 'PROCESSING' || (job.status === 'ERROR' && job.errorKind === 'RETRYABLE'))
    && job.nextAttemptAt <= now
    && (job.leaseExpiresAt === null || job.leaseExpiresAt <= now);
}

export function isTerminalJob(job: Job): boolean {
  return job.status === 'COMPLETE' || job.status === 'WAITING_FOR_CREDENTIALS' || (job.status === 'ERROR' && (job.errorKind !== 'RETRYABLE' || job.attempts >= JOB_MAX_ATTEMPTS));
}

export function canRenewJobLease(job: Job | undefined, id: string, owner: string, generation: number, now: number): job is Job {
  return Boolean(job && job.id === id && job.status === 'PROCESSING' && job.leaseOwner === owner
    && job.generation === generation && job.leaseExpiresAt !== null && job.leaseExpiresAt > now);
}

export function renewedLease(job: Job, now: number, leaseMs = JOB_LEASE_DURATION_MS): Job {
  return { ...job, leaseExpiresAt: now + leaseMs };
}

export function nextRetryAt(job: Job, now: number, failure: JobFailure): number {
  return failure.kind !== 'RETRYABLE' ? 0 : now + Math.max(failure.retryAfterMs ?? 0, Math.floor(Math.min(30_000, 2000 * 2 ** Math.min(Math.max(job.attempts - 1, 0), 4)) * (0.75 + Math.random() * 0.5)));
}

export function localChunkFailure(chunk: Chunk | undefined): JobFailure | null {
  if (!chunk) return { kind: 'PERMANENT', message: 'Chunk local ausente.' };
  if (!chunk.blob.size) return { kind: 'PERMANENT', message: 'Arquivo WebM vazio.' };
  if (!/^audio\/webm(?:\s*;\s*codecs=opus)?$/i.test(chunk.mimeType)) return { kind: 'PERMANENT', message: 'MIME do chunk incompatível.' };
  if (chunk.measuredDurationMs !== null && chunk.measuredDurationMs >= 1_800_000) return { kind: 'PERMANENT', message: 'A parte excede o limite de 30 minutos com diarização.' };
  if (chunk.measuredDurationMs === null && chunk.boundary.observedStopMs - chunk.boundary.observedStartMs >= 1_800_000) return { kind: 'PERMANENT', message: 'A duração aproximada não garante o limite de 30 minutos.' };
  if (chunk.error) return { kind: 'PERMANENT', message: chunk.error };
  return null;
}
