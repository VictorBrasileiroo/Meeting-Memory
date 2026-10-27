import type { AnalysisDiagnostic } from '../domain/analysis-diagnostic';
import { ANALYSIS_PROBE_MODEL, ANALYSIS_PROBE_SPACING_MS, analysisProbeStages, type AnalysisProbeRun, type AnalysisProbeStep } from '../domain/analysis-probe';
import type { Profile } from '../domain/profiles';
import { isTerminalJob, canClaimJob, canRenewJobLease, JOB_LEASE_DURATION_MS, JOB_MAX_ATTEMPTS, localChunkFailure, nextRetryAt, renewedLease, type JobFailure } from '../queue/job-policy';
import { TRANSCRIPTION_RATE_LIMIT, transcriptionWindow, type TranscriptionRateState } from '../queue/transcription-rate-limit';
import { analysisSourceKey, hasCompleteAnalysisInput } from '../domain/analysis-input';
import { meetingNotesSchema, NOTES_VERSION, PROMPT_VERSION, validateNotesOutput, type MeetingNotes, type NotesOutput } from '../domain/notes';
import { analysisModelSchema, type AnalysisModel } from '../domain/analysis-models';
import type { NotesValidation } from '../domain/notes-validation';
import { captureIntegrity } from '../domain/capture-integrity';

export const DB_NAME = 'meeting-memory';
export const DB_VERSION = 5;
export type CaptureEndReason = 'MANUAL' | 'TAB_CLOSED' | 'SOURCE_LOST';
export type Recording = { id: string; createdAt: number; startedAt: number | null; endedAt: number | null; profile: Profile; analysisModel?: AnalysisModel; retention?: 'delete-after-transcription' | 'keep-local'; status: string; revision: number; durationMs: number; chunkCount: number; completeness: 'COMPLETE' | 'PARTIAL' | 'UNKNOWN'; interruption: string | null; captureEndReason?: CaptureEndReason };
export type Chunk = { id: string; recordingId: string; index: number; recorderId: string; approximateStartMs: number; approximateEndMs: number; measuredDurationMs: number | null; overlapMs: number; mimeType: string; blob: Blob; status: 'PENDING' | 'COMPLETE' | 'ERROR'; attempts: number; error: string | null; boundary: { configMode: string; requestedStartMs: number; requestedEndMs: number; observedStartMs: number; observedStopMs: number; interrupted: boolean; durationSource: 'media' | 'clock'; requestedBitrate: number; observedBitrate: number; sizeBytes: number; finalized?: boolean; fragmentCount?: number } };
export type Fragment = { id: string; recordingId: string; recorderId: string; sequence: number; blob: Blob };
export type RemoteFile = { name: string; uri: string; mimeType: string };
export type TranscriptChunk = { id: string; recordingId: string; chunkId: string; chunkIndex: number; model: string; language: string; rawText: string; annotations: unknown[]; speakers: string[]; createdAt: number; sourceMimeType: string; sourceSize: number; remoteFileName: string; remoteDeleteStatus: 'PENDING' | 'DELETED'; attempt: number; metadata: { durationSource: 'media' | 'clock'; overlapMs: number; interactionId: string | null } };
export type Job = { id: string; kind: 'TRANSCRIBE_CHUNK' | 'DELETE_REMOTE_FILE' | 'ANALYZE_RECORDING'; recordingId: string; chunkId: string; status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'ERROR' | 'WAITING_FOR_CREDENTIALS'; attempts: number; nextAttemptAt: number; leaseOwner: string | null; leaseExpiresAt: number | null; generation: number; lastError: string | null; errorKind: JobFailure['kind'] | null; remoteFile?: RemoteFile; lastAnalysisDiagnostic?: AnalysisDiagnostic; analysisProbe?: AnalysisProbeRun; analysisModelOverride?: AnalysisModel };

function request<T>(value: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error ?? new Error('Falha no IndexedDB.')); }); }
function committed(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Transação abortada.')); tx.onerror = () => reject(tx.error ?? new Error('Falha na transação.')); }); }
export function openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const call = indexedDB.open(DB_NAME, DB_VERSION);
  let blocked = false;
  call.onupgradeneeded = () => {
    const db = call.result;
    if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('meetingDeletions')) db.createObjectStore('meetingDeletions', { keyPath: 'recordingId' });
    if (!db.objectStoreNames.contains('activeSession')) db.createObjectStore('activeSession');
    if (!db.objectStoreNames.contains('chunks')) { const chunks = db.createObjectStore('chunks', { keyPath: 'id' }); chunks.createIndex('recordingIndex', ['recordingId', 'index'], { unique: true }); chunks.createIndex('recordingId', 'recordingId'); }
    if (!db.objectStoreNames.contains('fragments')) { const fragments = db.createObjectStore('fragments', { keyPath: 'id' }); fragments.createIndex('recorderSequence', ['recorderId', 'sequence'], { unique: true }); fragments.createIndex('recorderId', 'recorderId'); }
    if (!db.objectStoreNames.contains('jobs')) { const jobs = db.createObjectStore('jobs', { keyPath: 'id' }); jobs.createIndex('status', 'status'); jobs.createIndex('recordingId', 'recordingId'); }
    if (!db.objectStoreNames.contains('transcripts')) { const transcripts = db.createObjectStore('transcripts', { keyPath: 'id' }); transcripts.createIndex('recordingId', 'recordingId'); }
    if (!db.objectStoreNames.contains('transcriptionRateLimits')) db.createObjectStore('transcriptionRateLimits');
    if (!db.objectStoreNames.contains('results')) db.createObjectStore('results', { keyPath: 'recordingId' });
  };
  call.onsuccess = () => { if (blocked) { call.result.close(); return; } call.result.onversionchange = () => call.result.close(); resolve(call.result); }; call.onerror = () => reject(call.error ?? new Error('Falha ao abrir IndexedDB.')); call.onblocked = () => { blocked = true; reject(new Error('Banco bloqueado por outra página da extensão. Feche as outras páginas e tente novamente.')); };
}); }
async function read<T>(stores: string | string[], action: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> { const db = await openDatabase(); try { const tx = db.transaction(stores, 'readonly'); const done = committed(tx); try { const result = await request(action(tx)); await done; return result; } catch (error) { await done.catch(() => undefined); throw error; } } finally { db.close(); } }
async function write<T>(stores: string | string[], action: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> { const db = await openDatabase(); try { const tx = db.transaction(stores, 'readwrite'); const done = committed(tx); try { const result = await request(action(tx)); await done; return result; } catch (error) { await done.catch(() => undefined); throw error; } } finally { db.close(); } }

// A tombstone is checked in the same transaction as every content write.
// DELETE_REMOTE_FILE remains valid after local content has been removed.
async function deletedIn(tx: IDBTransaction, recordingId: string): Promise<boolean> {
  return Boolean(await request(tx.objectStore('meetingDeletions').get(recordingId)));
}
async function deletedJob(tx: IDBTransaction, job: Job | undefined): Promise<boolean> {
  return Boolean(job && job.kind !== 'DELETE_REMOTE_FILE' && await deletedIn(tx, job.recordingId));
}
async function writeContent<T>(recordingId: string, stores: string[], action: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    const tx = db.transaction([...stores, 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    try {
      if (await deletedIn(tx, recordingId)) throw new Error('Esta reunião foi excluída. Nenhum conteúdo foi salvo.');
      const result = await request(action(tx)); await done; return result;
    } catch (error) { try { tx.abort(); } catch { /* Already aborted. */ } await done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}
export const wasRecordingDeleted = (id: string) => read<unknown>('meetingDeletions', tx => tx.objectStore('meetingDeletions').get(id)).then(Boolean);
export const listAllJobs = () => read<Job[]>('jobs', tx => tx.objectStore('jobs').getAll());

export async function createRecording(recording: Recording): Promise<void> { await writeContent(recording.id, ['recordings', 'activeSession'], (tx) => { tx.objectStore('activeSession').put(recording.id, 'current'); return tx.objectStore('recordings').add(recording); }); }
export const getRecording = (id: string) => read<Recording | undefined>('recordings', (tx) => tx.objectStore('recordings').get(id));
export async function updateRecording(recording: Recording): Promise<void> { await writeContent(recording.id, ['recordings'], (tx) => tx.objectStore('recordings').put(recording)); }
// A delayed START acknowledgement must never overwrite a final capture commit.
export async function confirmCaptureStarted(recordingId: string, startedAt: number): Promise<Recording> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['recordings', 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    try {
      if (await deletedIn(tx, recordingId)) throw new Error('Esta reunião foi excluída.');
      const store = tx.objectStore('recordings');
      const recording = await request(store.get(recordingId) as IDBRequest<Recording | undefined>);
      if (!recording) throw new Error('Gravação não encontrada.');
      const next = recording.startedAt === null && recording.endedAt === null ? { ...recording, startedAt, status: 'RECORDING', revision: recording.revision + 1 } : recording;
      if (next !== recording) store.put(next);
      await done; return next;
    } catch (error) { try { tx.abort(); } catch { /* Already settled. */ } await done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}
export const getActiveRecordingId = () => read<string | undefined>('activeSession', (tx) => tx.objectStore('activeSession').get('current'));
export async function clearActiveRecording(id: string): Promise<void> { if (await getActiveRecordingId() === id) await write('activeSession', (tx) => tx.objectStore('activeSession').delete('current')); }
export async function addFragment(fragment: Fragment): Promise<void> { await writeContent(fragment.recordingId, ['fragments'], (tx) => tx.objectStore('fragments').add(fragment)); }
export const listFragments = (recorderId: string) => read<Fragment[]>('fragments', (tx) => tx.objectStore('fragments').index('recorderId').getAll(recorderId)).then((rows) => rows.sort((a, b) => a.sequence - b.sequence));
export async function removeFragments(recorderId: string): Promise<void> { const rows = await listFragments(recorderId); const db = await openDatabase(); try { const tx = db.transaction(['fragments', 'meetingDeletions'], 'readwrite'); const done = committed(tx); for (const row of rows) tx.objectStore('fragments').delete(row.id); await done; } finally { db.close(); } }
export const listChunks = (recordingId: string) => read<Chunk[]>('chunks', (tx) => tx.objectStore('chunks').index('recordingId').getAll(recordingId)).then((rows) => rows.sort((a, b) => a.index - b.index));
export const getChunk = (id: string) => read<Chunk | undefined>('chunks', (tx) => tx.objectStore('chunks').get(id));

export async function finalizeCapture(recordingId: string, expectedCount: number, interrupted: boolean, reason: CaptureEndReason, observedStartedAt?: number): Promise<boolean> {
  // Blob reads must happen before opening the transaction (no async media I/O
  // inside IDB). Chunks are immutable except for retention, checked below.
  const headerChecks = new Map(await Promise.all((await listChunks(recordingId)).map(async chunk => {
    const bytes = new Uint8Array(await chunk.blob.slice(0, 4).arrayBuffer());
    return [chunk.id, bytes.length === 4 && [0x1a, 0x45, 0xdf, 0xa3].every((byte, index) => bytes[index] === byte)] as const;
  })));
  const db = await openDatabase();
  try {
    const tx = db.transaction(['recordings', 'chunks', 'transcripts', 'fragments', 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    try {
      if (await deletedIn(tx, recordingId)) throw new Error('Esta reunião foi excluída.');
      const store = tx.objectStore('recordings');
      const recording = await request(store.get(recordingId) as IDBRequest<Recording | undefined>);
      const startedAt = recording?.startedAt ?? observedStartedAt;
      if (!recording || startedAt === undefined || !Number.isFinite(startedAt) || startedAt < recording.createdAt) throw new Error('Início da captura não comprovado.');
      if (recording.endedAt !== null) { await done; return recording.completeness === 'COMPLETE'; }
      const chunks = await request(tx.objectStore('chunks').index('recordingId').getAll(recordingId) as IDBRequest<Chunk[]>);
      const transcripts = await request(tx.objectStore('transcripts').index('recordingId').getAll(recordingId) as IDBRequest<TranscriptChunk[]>);
      const fragments = await request(tx.objectStore('fragments').getAll() as IDBRequest<Fragment[]>);
      const complete = !interrupted && !fragments.some(fragment => fragment.recordingId === recordingId)
        && chunks.every(chunk => chunk.blob.size ? headerChecks.get(chunk.id) === true : transcripts.some(item => item.chunkId === chunk.id))
        && captureIntegrity(chunks, transcripts, expectedCount);
      const durationMs = Math.max(0, ...chunks.map(chunk => chunk.boundary.observedStopMs));
      store.put({ ...recording, startedAt, endedAt: startedAt + durationMs, durationMs, chunkCount: chunks.length,
        status: complete ? 'PROCESSING' : 'INTERRUPTED', completeness: complete ? 'COMPLETE' : 'PARTIAL',
        interruption: complete ? null : 'Integridade da captura não comprovada ou fonte interrompida.', captureEndReason: reason, revision: recording.revision + 1 } satisfies Recording);
      await done; return complete;
    } catch (error) { try { tx.abort(); } catch { /* Already settled. */ } await done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}
export async function commitChunk(chunk: Chunk): Promise<void> { const invalid = localChunkFailure(chunk); const job: Job = { id: `transcribe:${chunk.id}`, kind: 'TRANSCRIBE_CHUNK', recordingId: chunk.recordingId, chunkId: chunk.id, status: invalid ? 'ERROR' : 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: invalid?.message ?? null, errorKind: invalid?.kind ?? null }; await writeContent(chunk.recordingId, ['chunks', 'jobs'], (tx) => { tx.objectStore('chunks').add(invalid ? { ...chunk, status: 'ERROR', error: invalid.message } satisfies Chunk : chunk); return tx.objectStore('jobs').add(job); }); }
export const listJobs = (recordingId: string) => read<Job[]>('jobs', (tx) => tx.objectStore('jobs').index('recordingId').getAll(recordingId));
export const getTranscript = (chunkId: string) => read<TranscriptChunk | undefined>('transcripts', (tx) => tx.objectStore('transcripts').get(chunkId));
export const listTranscripts = (recordingId: string) => read<TranscriptChunk[]>('transcripts', (tx) => tx.objectStore('transcripts').index('recordingId').getAll(recordingId)).then((rows) => rows.sort((a, b) => a.chunkIndex - b.chunkIndex));
export async function saveRemoteFile(id: string, owner: string, generation: number, remoteFile: RemoteFile): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const store = tx.objectStore('jobs'); const job = await request(store.get(id) as IDBRequest<Job | undefined>); if (!canRenewJobLease(job, id, owner, generation, Date.now()) || await deletedJob(tx, job)) { await done; return false; } store.put({ ...job, remoteFile }); await done; return true; } finally { db.close(); } }
export async function persistTranscript(id: string, owner: string, generation: number, transcript: TranscriptChunk): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'transcripts', 'chunks', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs'); const job = await request(jobs.get(id) as IDBRequest<Job | undefined>); if (!canRenewJobLease(job, id, owner, generation, Date.now()) || await deletedJob(tx, job)) { await done; return false; } tx.objectStore('transcripts').put(transcript); const chunk = await request(tx.objectStore('chunks').get(job.chunkId) as IDBRequest<Chunk | undefined>); if (chunk) tx.objectStore('chunks').put({ ...chunk, status: 'COMPLETE', attempts: job.attempts, error: null } satisfies Chunk); jobs.put({ ...job, status: 'COMPLETE', leaseOwner: null, leaseExpiresAt: null, lastError: null, errorKind: null } satisfies Job); jobs.put({ id: `delete:${transcript.chunkId}`, kind: 'DELETE_REMOTE_FILE', recordingId: job.recordingId, chunkId: job.chunkId, status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null, remoteFile: job.remoteFile } satisfies Job); await done; return true; } finally { db.close(); } }
export async function markRemoteDeleted(chunkId: string, jobId: string, owner: string, generation: number): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'transcripts', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs'); const job = await request(jobs.get(jobId) as IDBRequest<Job | undefined>); if (!canRenewJobLease(job, jobId, owner, generation, Date.now())) { await done; return false; } const transcript = await request(tx.objectStore('transcripts').get(chunkId) as IDBRequest<TranscriptChunk | undefined>); if (transcript && transcript.remoteFileName === job.remoteFile?.name) tx.objectStore('transcripts').put({ ...transcript, remoteDeleteStatus: 'DELETED' } satisfies TranscriptChunk); if (await deletedIn(tx, job.recordingId)) jobs.delete(job.id); else jobs.put({ ...job, status: 'COMPLETE', leaseOwner: null, leaseExpiresAt: null, lastError: null, errorKind: null } satisfies Job); await done; return true; } finally { db.close(); } }
export async function enqueueOrphanCleanup(recordingId: string, chunkId: string, remoteFile: RemoteFile): Promise<void> { const job: Job = { id: `delete-orphan:${crypto.randomUUID()}`, kind: 'DELETE_REMOTE_FILE', recordingId, chunkId, status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null, remoteFile }; await write('jobs', (tx) => tx.objectStore('jobs').add(job)); }
export async function scheduleCleanupForFailedTranscriptions(recordingId: string): Promise<number> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'transcripts', 'meetingDeletions'], 'readwrite'); const done = committed(tx); if (await deletedIn(tx, recordingId)) { await done; return 0; } const jobs = tx.objectStore('jobs'); const all = await request(jobs.index('recordingId').getAll(recordingId) as IDBRequest<Job[]>); let count = 0; for (const job of all) {
    if (job.kind !== 'TRANSCRIBE_CHUNK' || job.status !== 'ERROR' || job.errorKind === 'RETRYABLE' || !job.remoteFile) continue;
    const transcript = await request(tx.objectStore('transcripts').get(job.chunkId) as IDBRequest<TranscriptChunk | undefined>);
    if (transcript) continue;
    const cleanupId = `delete-failed:${job.chunkId}`;
    const existing = await request(jobs.get(cleanupId) as IDBRequest<Job | undefined>);
    if (!existing) jobs.put({ id: cleanupId, kind: 'DELETE_REMOTE_FILE', recordingId: job.recordingId, chunkId: job.chunkId, status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null, remoteFile: job.remoteFile } satisfies Job);
    jobs.put({ ...job, remoteFile: undefined } satisfies Job); count++;
  } await done; return count; } finally { db.close(); } }
export async function completeExistingTranscript(id: string, owner: string, generation: number): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'transcripts', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs'); const job = await request(jobs.get(id) as IDBRequest<Job | undefined>); if (!canRenewJobLease(job, id, owner, generation, Date.now()) || await deletedJob(tx, job)) { await done; return false; } const transcript = await request(tx.objectStore('transcripts').get(job.chunkId) as IDBRequest<TranscriptChunk | undefined>); if (!transcript) { await done; return false; } jobs.put({ ...job, status: 'COMPLETE', leaseOwner: null, leaseExpiresAt: null, errorKind: null, lastError: null } satisfies Job); if (transcript.remoteDeleteStatus === 'PENDING') { const cleanupId = `delete:${job.chunkId}`; const cleanup = await request(jobs.get(cleanupId) as IDBRequest<Job | undefined>); if (!cleanup) jobs.put({ id: cleanupId, kind: 'DELETE_REMOTE_FILE', recordingId: job.recordingId, chunkId: job.chunkId, status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null, remoteFile: job.remoteFile ?? { name: transcript.remoteFileName, uri: '', mimeType: transcript.sourceMimeType } } satisfies Job); } await done; return true; } finally { db.close(); } }
export async function releaseAudio(chunkId: string): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['chunks', 'transcripts', 'jobs', 'results', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const transcript = await request(tx.objectStore('transcripts').get(chunkId) as IDBRequest<TranscriptChunk | undefined>); const job = await request(tx.objectStore('jobs').get(`transcribe:${chunkId}`) as IDBRequest<Job | undefined>); const cleanup = await request(tx.objectStore('jobs').get(`delete:${chunkId}`) as IDBRequest<Job | undefined>); if (!transcript || !job || job.status !== 'COMPLETE' || cleanup?.status !== 'COMPLETE' || transcript.remoteDeleteStatus !== 'DELETED') { await done; return false; } const chunk = await request(tx.objectStore('chunks').get(chunkId) as IDBRequest<Chunk | undefined>); if (chunk?.boundary.finalized && !await request(tx.objectStore('results').get(chunk.recordingId))) { await done; return false; } if (chunk?.blob.size) tx.objectStore('chunks').put({ ...chunk, blob: new Blob([], { type: chunk.mimeType }) } satisfies Chunk); await done; return true; } finally { db.close(); } }
export async function waitForCredentials(id: string, owner: string, generation: number): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs'); const job = await request(jobs.get(id) as IDBRequest<Job | undefined>); if (!canRenewJobLease(job, id, owner, generation, Date.now()) || await deletedJob(tx, job)) { await done; return false; } jobs.put({ ...job, status: 'WAITING_FOR_CREDENTIALS', attempts: Math.max(0, job.attempts - 1), leaseOwner: null, leaseExpiresAt: null, errorKind: 'USER_ACTION_REQUIRED', lastError: 'Configure sua chave Gemini em Configurações.' } satisfies Job); await done; return true; } finally { db.close(); } }
export async function resumeCredentialJobs(includeAuthFailures = false): Promise<void> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const store = tx.objectStore('jobs'); const all = await request(store.getAll() as IDBRequest<Job[]>); for (const job of all) if (!await deletedJob(tx, job) && (job.status === 'WAITING_FOR_CREDENTIALS' || (includeAuthFailures && job.status === 'ERROR' && job.errorKind === 'USER_ACTION_REQUIRED'))) store.put({ ...job, status: 'PENDING', attempts: 0, errorKind: null, lastError: null, nextAttemptAt: 0 } satisfies Job); await done; } finally { db.close(); } }
export async function retryFailedTranscriptions(recordingId: string): Promise<number> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'meetingDeletions'], 'readwrite'); const done = committed(tx); if (await deletedIn(tx, recordingId)) { await done; return 0; } const store = tx.objectStore('jobs'); const all = await request(store.index('recordingId').getAll(recordingId) as IDBRequest<Job[]>); let count = 0; for (const job of all) if (job.kind === 'TRANSCRIBE_CHUNK' && job.status === 'ERROR' && job.errorKind === 'RETRYABLE') { store.put({ ...job, status: 'PENDING', attempts: 0, nextAttemptAt: 0, errorKind: null, lastError: null } satisfies Job); count++; } await done; return count; } finally { db.close(); } }
export async function retryOneHttp404(recordingId: string, chunkId: string): Promise<boolean> { const db = await openDatabase(); try { const tx = db.transaction(['jobs', 'chunks', 'transcripts', 'meetingDeletions'], 'readwrite'); const done = committed(tx); if (await deletedIn(tx, recordingId)) { await done; return false; } const jobs = tx.objectStore('jobs'); const job = await request(jobs.get(`transcribe:${chunkId}`) as IDBRequest<Job | undefined>); const chunk = await request(tx.objectStore('chunks').get(chunkId) as IDBRequest<Chunk | undefined>); const transcript = await request(tx.objectStore('transcripts').get(chunkId) as IDBRequest<TranscriptChunk | undefined>); if (!job || job.recordingId !== recordingId || job.status !== 'ERROR' || !job.lastError?.includes('HTTP 404') || !chunk?.blob.size || transcript) { await done; return false; } jobs.put({ ...job, status: 'PENDING', attempts: 0, nextAttemptAt: 0, errorKind: null, lastError: null, remoteFile: undefined } satisfies Job); await done; return true; } finally { db.close(); } }
export async function failJob(id: string, owner: string, generation: number, failure: JobFailure): Promise<boolean> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'chunks', 'transcriptionRateLimits', 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    const jobs = tx.objectStore('jobs');
    const job = await request(jobs.get(id) as IDBRequest<Job | undefined>);
    const now = Date.now();
    if (!canRenewJobLease(job, id, owner, generation, now) || await deletedJob(tx, job)) { await done; return false; }
    let nextAttemptAt = nextRetryAt(job, now, failure);
    if (failure.rateLimited && job.kind === 'TRANSCRIBE_CHUNK') {
      const limits = tx.objectStore('transcriptionRateLimits');
      const previous = await request(limits.get(TRANSCRIPTION_RATE_LIMIT.model) as IDBRequest<TranscriptionRateState | undefined>);
      const { state } = transcriptionWindow(previous, now);
      // A 429 can be RPM, TPM, RPD or another quota. Share a cooldown,
      // respect Retry-After and retain the finite per-job retry budget.
      nextAttemptAt = Math.max(nextAttemptAt, state.observedAt + TRANSCRIPTION_RATE_LIMIT.windowMs + TRANSCRIPTION_RATE_LIMIT.safetyMs, state.blockedUntil);
      limits.put({ ...state, blockedUntil: nextAttemptAt }, TRANSCRIPTION_RATE_LIMIT.model);
    }
    jobs.put({ ...job, status: 'ERROR', errorKind: failure.kind, lastError: failure.message, ...(job.kind === 'ANALYZE_RECORDING' && failure.analysisDiagnostic ? { lastAnalysisDiagnostic: failure.analysisDiagnostic } : {}), nextAttemptAt, leaseOwner: null, leaseExpiresAt: null } satisfies Job);
    if (job.kind === 'TRANSCRIBE_CHUNK') {
      const chunk = await request(tx.objectStore('chunks').get(job.chunkId) as IDBRequest<Chunk | undefined>);
      if (chunk) tx.objectStore('chunks').put({ ...chunk, status: 'ERROR', attempts: job.attempts, error: failure.kind === 'PERMANENT' ? failure.message : null } satisfies Chunk);
    }
    await done; return true;
  } finally { db.close(); }
}

export async function claimJob(owner: string, now = Date.now(), leaseMs = JOB_LEASE_DURATION_MS, allowedKinds: Job['kind'][] = ['TRANSCRIBE_CHUNK', 'DELETE_REMOTE_FILE', 'ANALYZE_RECORDING']): Promise<Job | null> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'transcripts', 'transcriptionRateLimits', 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    const store = tx.objectStore('jobs');
    const previous = await request(tx.objectStore('transcriptionRateLimits').get(TRANSCRIPTION_RATE_LIMIT.model) as IDBRequest<TranscriptionRateState | undefined>);
    const { nextAllowedAt } = transcriptionWindow(previous, now);
    const all = await request(store.getAll() as IDBRequest<Job[]>);
    for (const job of all) {
      if (await deletedJob(tx, job)) continue;
      const probing = Boolean(job.analysisProbe && !job.analysisProbe.done);
      const maxAttempts = probing ? analysisProbeStages(job.analysisProbe).length : JOB_MAX_ATTEMPTS;
      if (job.attempts >= maxAttempts && ((job.status === 'PROCESSING' && job.leaseExpiresAt !== null && job.leaseExpiresAt <= now) || (probing && job.status === 'PENDING'))) {
        store.put({ ...job, status: 'ERROR', errorKind: probing ? 'PERMANENT' : 'RETRYABLE', lastError: 'O executor foi interrompido e o limite de tentativas foi atingido. Tente novamente explicitamente.',
          ...(probing && job.analysisProbe ? { analysisProbe: { ...job.analysisProbe, done: true } } : {}), leaseOwner: null, leaseExpiresAt: null } satisfies Job);
        continue;
      }
      if (!allowedKinds.includes(job.kind) || !canClaimJob(job, now)) continue;
      if (job.kind === 'TRANSCRIBE_CHUNK' && nextAllowedAt > now) {
        const transcript = await request(tx.objectStore('transcripts').get(job.chunkId));
        if (!transcript) {
          store.put({ ...job, status: 'PENDING', nextAttemptAt: nextAllowedAt, leaseOwner: null, leaseExpiresAt: null } satisfies Job);
          continue;
        }
      }
      const claimed: Job = { ...job, status: 'PROCESSING', attempts: job.attempts + 1, leaseOwner: owner, leaseExpiresAt: now + leaseMs, generation: job.generation + 1, errorKind: null };
      store.put(claimed); await done; return claimed;
    }
    await done; return null;
  } finally { db.close(); }
}

// Final admission immediately before interactions.create. Concurrent executors
// serialize this short transaction; no network or long waits hold the lease.
export async function reserveTranscription(id: string, owner: string, generation: number, now = Date.now()): Promise<'ADMITTED' | 'DEFERRED' | 'STALE'> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'transcriptionRateLimits', 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    const jobs = tx.objectStore('jobs'); const limits = tx.objectStore('transcriptionRateLimits');
    const job = await request(jobs.get(id) as IDBRequest<Job | undefined>);
    if (!canRenewJobLease(job, id, owner, generation, now) || await deletedJob(tx, job) || job.kind !== 'TRANSCRIBE_CHUNK') { await done; return 'STALE'; }
    const previous = await request(limits.get(TRANSCRIPTION_RATE_LIMIT.model) as IDBRequest<TranscriptionRateState | undefined>);
    const { state, nextAllowedAt } = transcriptionWindow(previous, now);
    if (nextAllowedAt > now) {
      jobs.put({ ...job, status: 'PENDING', attempts: Math.max(0, job.attempts - 1), nextAttemptAt: nextAllowedAt, leaseOwner: null, leaseExpiresAt: null } satisfies Job);
      limits.put(state, TRANSCRIPTION_RATE_LIMIT.model);
      await done; return 'DEFERRED';
    }
    limits.put({ ...state, starts: [...state.starts, state.observedAt] }, TRANSCRIPTION_RATE_LIMIT.model);
    await done; return 'ADMITTED';
  } finally { db.close(); }
}
export async function renewJobLease(id: string, owner: string, generation: number, now = Date.now(), leaseMs = JOB_LEASE_DURATION_MS): Promise<boolean> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs');
    try {
      const job = await request(jobs.get(id) as IDBRequest<Job | undefined>);
      if (!canRenewJobLease(job, id, owner, generation, now) || await deletedJob(tx, job)) { await done; return false; }
      jobs.put(renewedLease(job, now, leaseMs));
      await done; return true;
    } catch (error) { await done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}

export const listRecordings = () => read<Recording[]>('recordings', (tx) => tx.objectStore('recordings').getAll()).then((rows) => rows.sort((a, b) => b.createdAt - a.createdAt));
export const getNotes = (recordingId: string) => read<MeetingNotes | undefined>('results', (tx) => tx.objectStore('results').get(recordingId));
export const analysisJobId = (recording: Recording) => `analyze:${recording.id}:${recording.analysisModel}:v${NOTES_VERSION}`;

// One final result per recording, frozen model and contract. Never analyze an
// interrupted session or old recordings lacking an explicitly frozen model.
export async function enqueueAnalysis(recordingId: string): Promise<boolean> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['recordings', 'chunks', 'transcripts', 'jobs', 'results', 'meetingDeletions'], 'readwrite'); const done = committed(tx); if (await deletedIn(tx, recordingId)) { await done; return false; }
    const recording = await request(tx.objectStore('recordings').get(recordingId) as IDBRequest<Recording | undefined>);
    if (!recording || !analysisModelSchema.safeParse(recording.analysisModel).success || !recording.endedAt) { await done; return false; }
    const jobs = tx.objectStore('jobs');
    if (await request(jobs.get(analysisJobId(recording))) || await request(tx.objectStore('results').get(recordingId))) { await done; return false; }
    const chunks = await request(tx.objectStore('chunks').index('recordingId').getAll(recordingId) as IDBRequest<Chunk[]>);
    const transcripts = await request(tx.objectStore('transcripts').index('recordingId').getAll(recordingId) as IDBRequest<TranscriptChunk[]>);
    if (!hasCompleteAnalysisInput(recording, chunks, transcripts)) { await done; return false; }
    jobs.add({ id: analysisJobId(recording), kind: 'ANALYZE_RECORDING', recordingId, chunkId: '', status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null } satisfies Job);
    await done; return true;
  } finally { db.close(); }
}

export async function persistNotes(id: string, owner: string, generation: number, output: NotesOutput, sourceKey: string, validation?: NotesValidation): Promise<boolean> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['recordings', 'chunks', 'transcripts', 'jobs', 'results', 'meetingDeletions'], 'readwrite'); const done = committed(tx);
    try {
      const jobs = tx.objectStore('jobs');
      const job = await request(jobs.get(id) as IDBRequest<Job | undefined>);
      if (!canRenewJobLease(job, id, owner, generation, Date.now()) || await deletedJob(tx, job) || job.kind !== 'ANALYZE_RECORDING') { await done; return false; }
      const recording = await request(tx.objectStore('recordings').get(job.recordingId) as IDBRequest<Recording | undefined>);
      if (!recording || analysisJobId(recording) !== id) { await done; return false; }
      const transcripts = await request(tx.objectStore('transcripts').index('recordingId').getAll(recording.id) as IDBRequest<TranscriptChunk[]>);
      const chunks = await request(tx.objectStore('chunks').index('recordingId').getAll(recording.id) as IDBRequest<Chunk[]>);
      if (!hasCompleteAnalysisInput(recording, chunks, transcripts) || analysisSourceKey(transcripts) !== sourceKey) { await done; return false; }
      const validated = validateNotesOutput(output, recording.profile, transcripts);
      const notes = meetingNotesSchema.parse({ recordingId: recording.id, profile: recording.profile, analysisModel: job.analysisModelOverride ?? recording.analysisModel,
        schemaVersion: NOTES_VERSION, promptVersion: PROMPT_VERSION, createdAt: Date.now(), sourceKey, output: validated, ...(validation ? { validation } : {}) });
      // add prevents overwriting a valid final result. All state changes share the commit.
      const existing = await request(tx.objectStore('results').get(recording.id));
      if (!existing) tx.objectStore('results').add(notes);
      jobs.put({ ...job, status: 'COMPLETE', leaseOwner: null, leaseExpiresAt: null, lastError: null, errorKind: null } satisfies Job);
      tx.objectStore('recordings').put({ ...recording, status: 'COMPLETED', revision: recording.revision + 1 } satisfies Recording);
      await done; return true;
    } catch (error) { tx.abort(); await done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}

export async function completeExistingNotes(id: string, owner: string, generation: number): Promise<boolean> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'results', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs');
    const job = await request(jobs.get(id) as IDBRequest<Job | undefined>);
    if (!canRenewJobLease(job, id, owner, generation, Date.now()) || await deletedJob(tx, job) || job.kind !== 'ANALYZE_RECORDING' || !await request(tx.objectStore('results').get(job.recordingId))) { await done; return false; }
    jobs.put({ ...job, status: 'COMPLETE', leaseOwner: null, leaseExpiresAt: null, lastError: null, errorKind: null } satisfies Job);
    await done; return true;
  } finally { db.close(); }
}

export async function retryAnalysis(recordingId: string, mode: 'notes' | 'probe' = 'notes', model?: AnalysisModel): Promise<number> {
  if (model !== undefined && (mode !== 'notes' || model !== 'gemini-3.5-flash-lite')) return 0;
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'results', 'recordings', 'chunks', 'transcripts', 'meetingDeletions'], 'readwrite'); const done = committed(tx); if (await deletedIn(tx, recordingId)) { await done; return 0; } const jobs = tx.objectStore('jobs');
    if (await request(tx.objectStore('results').get(recordingId))) { await done; return 0; }
    const recording = await request(tx.objectStore('recordings').get(recordingId) as IDBRequest<Recording | undefined>);
    if (!recording || !analysisModelSchema.safeParse(recording.analysisModel).success) { await done; return 0; }
    const job = await request(jobs.get(analysisJobId(recording)) as IDBRequest<Job | undefined>);
    // Explicit terminal retry only: never steal a lease, bypass a cooldown,
    // create another job or re-run a valid final result. A model override is
    // explicit and persists on this job; the original recording stays unchanged.
    if (!job || job.kind !== 'ANALYZE_RECORDING' || job.recordingId !== recordingId || job.status !== 'ERROR' || !isTerminalJob(job) || (job.leaseExpiresAt !== null && job.leaseExpiresAt > Date.now())) { await done; return 0; }
    const chunks = await request(tx.objectStore('chunks').index('recordingId').getAll(recordingId) as IDBRequest<Chunk[]>);
    const transcripts = await request(tx.objectStore('transcripts').index('recordingId').getAll(recordingId) as IDBRequest<TranscriptChunk[]>);
    if (!hasCompleteAnalysisInput(recording, chunks, transcripts)) { await done; return 0; }
    jobs.put({ ...job, status: 'PENDING', attempts: 0, nextAttemptAt: 0, errorKind: null, lastError: null, leaseOwner: null, leaseExpiresAt: null,
      ...(model ? { analysisModelOverride: model } : {}),
      ...(mode === 'probe' ? { analysisProbe: { version: 2, model: ANALYSIS_PROBE_MODEL, nextStage: 0, done: false, results: [] } } : job.analysisProbe ? { analysisProbe: { ...job.analysisProbe, done: true } } : {}) } satisfies Job);
    await done; return 1;
  } finally { db.close(); }
}

export async function persistAnalysisProbeStep(id: string, owner: string, generation: number, step: AnalysisProbeStep, now = Date.now()): Promise<boolean> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'meetingDeletions'], 'readwrite'); const done = committed(tx); const jobs = tx.objectStore('jobs');
    const job = await request(jobs.get(id) as IDBRequest<Job | undefined>);
    if (!canRenewJobLease(job, id, owner, generation, now) || await deletedJob(tx, job) || job.kind !== 'ANALYZE_RECORDING' || !job.analysisProbe || job.analysisProbe.done
      || analysisProbeStages(job.analysisProbe)[job.analysisProbe.nextStage] !== step.stage) { await done; return false; }
    const nextStage = job.analysisProbe.nextStage + 1;
    const finished = step.outcome === 'FAILED' || nextStage === analysisProbeStages(job.analysisProbe).length;
    jobs.put({ ...job, analysisProbe: { ...job.analysisProbe, nextStage, done: finished, results: [...job.analysisProbe.results, step] },
      status: finished ? 'ERROR' : 'PENDING', errorKind: finished ? 'PERMANENT' : null,
      lastError: finished ? step.outcome === 'FAILED' ? 'Teste técnico interrompido nesta etapa. Consulte o diagnóstico; nenhuma reunião foi enviada.' : 'Testes técnicos aceitos pela API. Isso não valida as notas da reunião. Nenhuma análise da sessão foi executada.' : null,
      ...(step.diagnostic ? { lastAnalysisDiagnostic: step.diagnostic } : {}),
      nextAttemptAt: finished ? 0 : now + ANALYSIS_PROBE_SPACING_MS, leaseOwner: null, leaseExpiresAt: null } satisfies Job);
    await done; return true;
  } finally { db.close(); }
}
