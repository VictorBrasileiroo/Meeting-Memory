// Initial conservative project setting, not a universal Gemini quota.
export const TRANSCRIPTION_RATE_LIMIT = {
  model: 'gemini-3.5-transcribe',
  requests: 3,
  windowMs: 60_000,
  safetyMs: 1_000,
} as const;

export type TranscriptionRateState = { starts: number[]; blockedUntil: number; observedAt: number };

export function transcriptionWindow(state: TranscriptionRateState | undefined, now: number) {
  // A clock rollback must not discard recent reservations.
  const observedAt = Math.max(now, state?.observedAt ?? now);
  const windowMs = TRANSCRIPTION_RATE_LIMIT.windowMs + TRANSCRIPTION_RATE_LIMIT.safetyMs;
  const starts = (state?.starts ?? []).filter((start) => start + windowMs > observedAt).sort((a, b) => a - b);
  const blockedUntil = state?.blockedUntil ?? 0;
  const nextAllowedAt = Math.max(blockedUntil, starts.length >= TRANSCRIPTION_RATE_LIMIT.requests ? starts[0]! + windowMs : 0);
  return { state: { starts, blockedUntil, observedAt }, nextAllowedAt };
}
