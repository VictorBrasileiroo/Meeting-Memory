import { afterEach, expect, it, vi } from 'vitest';
import { classifyGeminiError } from '../src/gemini/transcription';
import { nextRetryAt } from '../src/queue/job-policy';
import type { Job } from '../src/storage/recordings';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it.each([
  ['12', 12_000], [' 1.5 ', 1500], ['0', 0], ['not-a-date', 0],
  ['-1', 0], ['Fri, 01 Jan 2027 00:02:00 GMT', 120_000], ['Thu, 31 Dec 2026 23:59:00 GMT', 0], ['172800', 172_800_000],
])('interpreta Retry-After %s em segundos ou data sem cortar esperas válidas', (header, delay) => {
  vi.useFakeTimers(); vi.setSystemTime(Date.parse('2027-01-01T00:00:00Z'));
  expect(classifyGeminiError({ status: 429, response: { headers: new Headers({ 'Retry-After': header }) } })).toMatchObject({ kind: 'RETRYABLE', rateLimited: true, retryAfterMs: delay });
});
it('backoff aplica jitter e respeita Retry-After maior que o backoff', () => {
  const job = { attempts: 2 } as Job;
  vi.spyOn(Math, 'random').mockReturnValue(0);
  expect(nextRetryAt(job, 1000, { kind: 'RETRYABLE', message: 'offline' })).toBe(4000);
  vi.mocked(Math.random).mockReturnValue(1);
  expect(nextRetryAt(job, 1000, { kind: 'RETRYABLE', message: 'offline' })).toBe(6000);
  expect(nextRetryAt(job, 1000, { kind: 'RETRYABLE', message: '429', retryAfterMs: 120_000 })).toBe(121_000);
});
