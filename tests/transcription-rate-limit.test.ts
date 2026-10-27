import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimJob, commitChunk, DB_NAME, failJob, getChunk, getTranscript, listJobs, markRemoteDeleted, openDatabase, persistTranscript, reserveTranscription, saveRemoteFile } from '../src/storage/recordings';
import { TRANSCRIPTION_RATE_LIMIT } from '../src/queue/transcription-rate-limit';
import { classifyGeminiError } from '../src/gemini/transcription';
import { makeChunk, makeTranscript } from './fixtures/recording';

const base = 1_000_000;
const windowMs = TRANSCRIPTION_RATE_LIMIT.windowMs + TRANSCRIPTION_RATE_LIMIT.safetyMs;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(base);
  await new Promise<void>((resolve, reject) => { const call = indexedDB.deleteDatabase(DB_NAME); call.onsuccess = () => resolve(); call.onerror = () => reject(call.error); });
});
afterEach(() => vi.useRealTimers());
async function admit(index: number, now = Date.now()) {
  vi.setSystemTime(now);
  await commitChunk(makeChunk(index));
  const job = (await claimJob('A', now, 1_000_000, ['TRANSCRIBE_CHUNK']))!;
  expect(job).not.toBeNull();
  expect(await reserveTranscription(job.id, 'A', job.generation, now)).toBe('ADMITTED');
  return job;
}

describe('admissão de transcrição persistente', () => {
  it('primeira é imediata, permite três e agenda a quarta sem lease ou tentativa', async () => {
    await admit(1); await admit(2); await admit(3);
    await commitChunk(makeChunk(4));
    expect(await claimJob('B')).toBeNull();
    expect((await listJobs('recording')).find((job) => job.chunkId === 'chunk-4')).toMatchObject({ attempts: 0, status: 'PENDING', nextAttemptAt: base + windowMs, leaseOwner: null, leaseExpiresAt: null });
    vi.setSystemTime(base + 60_000); expect(await claimJob('B')).toBeNull();
    vi.setSystemTime(base + windowMs);
    const fourth = (await claimJob('B'))!;
    expect(fourth.attempts).toBe(1);
    expect(await reserveTranscription(fourth.id, 'B', fourth.generation)).toBe('ADMITTED');
  });
  it('usa janela móvel e não reset em minuto fixo', async () => {
    await admit(1); await admit(2, base + 20_000); await admit(3, base + 40_000);
    await commitChunk(makeChunk(4));
    vi.setSystemTime(base + 60_000); expect(await claimJob('B')).toBeNull();
    vi.setSystemTime(base + windowMs); const fourth = (await claimJob('B'))!;
    expect(await reserveTranscription(fourth.id, 'B', fourth.generation)).toBe('ADMITTED');
    await commitChunk(makeChunk(5)); expect(await claimJob('B')).toBeNull();
    expect((await listJobs('recording')).find((job) => job.chunkId === 'chunk-5')?.nextAttemptAt).toBe(base + 20_000 + windowMs);
  });
  it('reimportar o executor/repository não limpa reservas; relógio avançando libera', async () => {
    await admit(1); await admit(2); await admit(3); await commitChunk(makeChunk(4));
    vi.resetModules();
    const restarted = await import('../src/storage/recordings');
    expect(await restarted.claimJob('restarted')).toBeNull();
    vi.setSystemTime(base + 10 * windowMs);
    const job = (await restarted.claimJob('restarted'))!;
    expect(await restarted.reserveTranscription(job.id, 'restarted', job.generation)).toBe('ADMITTED');
  });
  it('reservas concorrentes são atômicas e devolvem a tentativa e o lease da quarta', async () => {
    for (let i = 1; i <= 4; i++) await commitChunk(makeChunk(i));
    const jobs = await Promise.all(['A', 'B', 'C', 'D'].map((owner) => claimJob(owner)));
    expect(new Set(jobs.map((job) => job?.id)).size).toBe(4);
    await Promise.all(jobs.map((job, i) => saveRemoteFile(job!.id, ['A', 'B', 'C', 'D'][i]!, job!.generation, { name: `files/${i}`, uri: 'https://file', mimeType: 'audio/webm' })));
    const results = await Promise.all(jobs.map((job, i) => reserveTranscription(job!.id, ['A', 'B', 'C', 'D'][i]!, job!.generation)));
    expect(results.filter((value) => value === 'ADMITTED')).toHaveLength(3);
    expect(results.filter((value) => value === 'DEFERRED')).toHaveLength(1);
    const waiting = (await listJobs('recording')).find((job) => job.status === 'PENDING')!;
    expect(waiting).toMatchObject({ attempts: 0, leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: base + windowMs });
    expect(waiting.remoteFile?.name).toMatch(/^files\//);
    expect(await reserveTranscription(waiting.id, 'stale', waiting.generation)).toBe('STALE');
    expect(await claimJob('E')).toBeNull();
  });
  it('relógio voltando não descarta reservas recentes', async () => {
    await admit(1); await admit(2); await admit(3);
    vi.setSystemTime(base - 120_000); await commitChunk(makeChunk(4));
    expect(await claimJob('B')).toBeNull();
    expect((await listJobs('recording')).at(-1)?.nextAttemptAt).toBe(base + windowMs);
  });
  it('falha de rede mantém reserva, áudio e arquivo remoto para retomada', async () => {
    const job = await admit(1);
    await saveRemoteFile(job.id, 'A', job.generation, { name: 'files/1', uri: 'https://file', mimeType: 'audio/webm' });
    await failJob(job.id, 'A', job.generation, classifyGeminiError(new TypeError('offline')));
    await admit(2); await admit(3);
    vi.setSystemTime(base + 10_000); expect(await claimJob('B')).toBeNull();
    const waiting = (await listJobs('recording')).find((item) => item.id === job.id)!;
    expect(waiting).toMatchObject({ attempts: 1, remoteFile: { name: 'files/1' } });
    expect((await getChunk(job.chunkId))?.blob.size).toBe(4);
    vi.setSystemTime(base + windowMs); const retry = (await claimJob('B'))!;
    expect(retry).toMatchObject({ id: job.id, attempts: 2, remoteFile: { name: 'files/1' } });
  });
  it('429 coordena cooldown persistente, inclusive sem Retry-After; cleanup continua', async () => {
    const first = await admit(1);
    await saveRemoteFile(first.id, 'A', first.generation, { name: 'files/1', uri: 'https://file', mimeType: 'audio/webm' });
    await persistTranscript(first.id, 'A', first.generation, makeTranscript());
    const second = await admit(2);
    const error = classifyGeminiError({ status: 429, headers: new Headers({ 'Retry-After': '120' }) });
    await failJob(second.id, 'A', second.generation, error);
    await commitChunk(makeChunk(3));
    const cleanup = (await claimJob('B'))!;
    expect(cleanup.kind).toBe('DELETE_REMOTE_FILE');
    await markRemoteDeleted(cleanup.chunkId, cleanup.id, 'B', cleanup.generation);
    expect(await claimJob('B')).toBeNull();
    expect((await listJobs('recording')).find((job) => job.id === second.id)?.nextAttemptAt).toBe(base + 120_000);
    expect((await getTranscript('chunk-1'))?.rawText).toBe('Texto original.');
    vi.setSystemTime(base + 120_000);
    const retry = (await claimJob('B'))!;
    expect(await reserveTranscription(retry.id, 'B', retry.generation)).toBe('ADMITTED');
    await failJob(retry.id, 'B', retry.generation, classifyGeminiError({ status: 429 }));
    expect(await claimJob('B')).toBeNull();
    expect((await listJobs('recording')).find((job) => job.id === retry.id)?.nextAttemptAt).toBe(Date.now() + windowMs);
  });
  it('429 persistente esgota cinco tentativas e preserva áudio sem retry imediato', async () => {
    await commitChunk(makeChunk());
    for (let attempt = 1; attempt <= 5; attempt++) {
      const job = (await claimJob('A'))!; expect(job.attempts).toBe(attempt);
      expect(await reserveTranscription(job.id, 'A', job.generation)).toBe('ADMITTED');
      await failJob(job.id, 'A', job.generation, classifyGeminiError({ status: 429 }));
      expect(await claimJob('A')).toBeNull();
      vi.setSystemTime(Date.now() + windowMs);
    }
    expect(await claimJob('A')).toBeNull();
    expect((await getChunk('chunk-1'))?.blob.size).toBe(4);
  });
  it('IDB v2 migra sem perder transcrições existentes', async () => {
    await new Promise<void>((resolve, reject) => {
      const call = indexedDB.open(DB_NAME, 2);
      call.onupgradeneeded = () => { const store = call.result.createObjectStore('transcripts', { keyPath: 'id' }); store.createIndex('recordingId', 'recordingId'); store.add(makeTranscript()); };
      call.onsuccess = () => { call.result.close(); resolve(); }; call.onerror = () => reject(call.error);
    });
    const db = await openDatabase(); expect(db.version).toBe(5); expect(db.objectStoreNames.contains('transcriptionRateLimits')).toBe(true); expect(db.objectStoreNames.contains('results')).toBe(true); db.close();
    expect(await getTranscript('chunk-1')).toEqual(makeTranscript());
  });
});
