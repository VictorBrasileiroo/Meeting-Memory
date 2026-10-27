import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addFragment, claimJob, commitChunk, createRecording, DB_NAME, enqueueOrphanCleanup, failJob, getChunk, getNotes, getRecording, listJobs, listTranscripts, markRemoteDeleted, openDatabase, persistNotes, persistTranscript, renewJobLease, reserveTranscription, retryAnalysis, retryFailedTranscriptions, saveRemoteFile, updateRecording, wasRecordingDeleted, type Job } from '../src/storage/recordings';
import { cleanupSummary, deletionReason, idbRequest, listManagedMeetings, measureMeetings, mutateMeeting, transactionDone } from '../src/storage/meeting-management';
import { analysisRecording, meetingNotes, notesOutput } from './fixtures/notes';
import { makeChunk, makeTranscript } from './fixtures/recording';

beforeEach(async () => { await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); }); });
afterEach(() => { vi.restoreAllMocks(); });
const completeJob = (id: string, kind: Job['kind'], recordingId = 'recording'): Job => ({ id, kind, recordingId, chunkId: 'chunk-1', status: 'COMPLETE', attempts: 1, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 1, lastError: null, errorKind: null });
async function seed(options: { audio?: boolean; fragments?: boolean; pendingCleanup?: boolean; job?: Partial<Job>; id?: string } = {}) {
  const id = options.id ?? 'recording';
  const db = await openDatabase(); const tx = db.transaction(['recordings', 'activeSession', 'chunks', 'fragments', 'transcripts', 'jobs', 'results'], 'readwrite'); const done = transactionDone(tx);
  tx.objectStore('recordings').put({ ...analysisRecording(1), id, status: 'COMPLETED' });
  tx.objectStore('activeSession').put(id, 'current');
  tx.objectStore('chunks').put({ ...makeChunk(), recordingId: id, status: 'COMPLETE', blob: options.audio === false ? new Blob([]) : new Blob(['audio']), boundary: { ...makeChunk().boundary, sizeBytes: 999999 } });
  tx.objectStore('transcripts').put({ ...makeTranscript(), recordingId: id, remoteDeleteStatus: options.pendingCleanup ? 'PENDING' : 'DELETED', sourceSize: 999999 });
  tx.objectStore('results').put({ ...meetingNotes(), recordingId: id });
  tx.objectStore('jobs').put({ ...completeJob('transcribe:chunk-1', 'TRANSCRIBE_CHUNK', id), ...options.job });
  tx.objectStore('jobs').put({ ...completeJob('delete:chunk-1', 'DELETE_REMOTE_FILE', id), status: options.pendingCleanup ? 'PENDING' : 'COMPLETE', remoteFile: { name: 'files/1', uri: 'remote-fixture', mimeType: 'audio/webm' } });
  if (options.fragments) tx.objectStore('fragments').put({ id: 'fragment', recordingId: id, recorderId: 'recorder', sequence: 1, blob: new Blob(['fragment']) });
  await done; db.close();
}

describe('medição e leitura', () => {
  it('lista metadados sem abrir os stores de áudio e mede o Blob atual, não o tamanho histórico', async () => {
    await seed();
    const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll'); const indexAll = vi.spyOn(IDBIndex.prototype, 'getAll');
    const rows = await listManagedMeetings();
    expect(rows[0]).toMatchObject({ hasNotes: true, transcriptCount: 1, size: null });
    expect(getAll.mock.instances.some(store => ['chunks', 'fragments'].includes((store as IDBObjectStore).name))).toBe(false);
    expect(indexAll.mock.instances.some(index => (index as IDBIndex).objectStore.name === 'chunks')).toBe(false);
    const result = await measureMeetings(rows, () => undefined);
    expect(result.rows[0]!.size!.audioBytes).toBe(5); expect(result.rows[0]!.size!.textBytes).toBeGreaterThan(0);
    expect(result.rows[0]!.audioReason).toBeNull();
  });
  it('conta áudio vazio como zero e inclui fragmentos, preservando áudio não associado', async () => {
    await seed({ audio: false, fragments: true });
    await addFragment({ id: 'orphan', recordingId: 'missing', recorderId: 'other', sequence: 1, blob: new Blob(['orphan']) });
    const result = await measureMeetings(await listManagedMeetings(), () => undefined);
    expect(result.rows[0]!.size).toMatchObject({ audioBytes: 8, fragmentBytes: 8 }); expect(result.rows[0]!.audioReason).toContain('fragmentos'); expect(result.unassociatedAudioBytes).toBe(6);
  });
  it('varredura é abortável e usa lotes curtos', async () => {
    await seed(); const db = await openDatabase(); const tx = db.transaction('fragments', 'readwrite'); const done = transactionDone(tx);
    for (let i = 0; i < 230; i++) tx.objectStore('fragments').put({ id: `f-${i}`, recordingId: 'recording', recorderId: 'r', sequence: i, blob: new Blob(['x']) });
    await done; db.close();
    const controller = new AbortController(); const progress: number[] = [];
    await expect(measureMeetings(await listManagedMeetings(), count => { progress.push(count); if (count > 100) controller.abort(); }, controller.signal)).rejects.toThrow();
    expect(progress.at(-1)!).toBeLessThan(231); expect((await getChunk('chunk-1'))!.blob.size).toBe(5);
  });
});

describe('remoção de áudio', () => {
  it('preserva notas, texto bruto, jobs e metadados das partes', async () => {
    await seed(); const notes = await getNotes('recording'); const transcripts = await listTranscripts('recording');
    const result = await mutateMeeting('recording', 'REMOVE_RECORDING_AUDIO');
    expect(result.removedAudioBytes).toBe(5); expect((await getChunk('chunk-1'))!.blob.size).toBe(0);
    expect(await getNotes('recording')).toEqual(notes); expect(await listTranscripts('recording')).toEqual(transcripts);
    expect(await listJobs('recording')).toHaveLength(2); expect(await wasRecordingDeleted('recording')).toBe(false);
  });
  it.each([
    { pendingCleanup: true }, { fragments: true },
    { job: { status: 'ERROR' as const, errorKind: 'PERMANENT' as const } },
  ])('recusa material não elegível e não altera nenhum Blob (%j)', async options => {
    await seed(options); await expect(mutateMeeting('recording', 'REMOVE_RECORDING_AUDIO')).rejects.toThrow();
    expect((await getChunk('chunk-1'))!.blob.size).toBe(5); expect(await getNotes('recording')).toBeDefined();
  });
});

describe('exclusão atômica e corridas', () => {
  it('remove a cascata e o ID ativo, mas conserva marcador mínimo e outra reunião', async () => {
    await seed({ fragments: true }); await createRecording({ ...analysisRecording(), id: 'other', status: 'COMPLETED' });
    await mutateMeeting('recording', 'DELETE_RECORDING');
    expect(await getRecording('recording')).toBeUndefined(); expect(await getNotes('recording')).toBeUndefined(); expect(await listTranscripts('recording')).toEqual([]); expect(await getChunk('chunk-1')).toBeUndefined();
    expect(await getRecording('other')).toBeDefined(); expect(await wasRecordingDeleted('recording')).toBe(true);
    const db = await openDatabase(); const tx = db.transaction(['activeSession', 'fragments', 'meetingDeletions']);
    expect(await idbRequest(tx.objectStore('activeSession').get('current'))).toBe('other'); expect(await idbRequest(tx.objectStore('fragments').count())).toBe(0);
    const marker = await idbRequest(tx.objectStore('meetingDeletions').get('recording')); expect(Object.keys(marker).sort()).toEqual(['deletedAt', 'recordingId']); db.close();
    expect(await listManagedMeetings()).toHaveLength(1);
  });
  it.each(['PENDING', 'PROCESSING', 'WAITING_FOR_CREDENTIALS'] as const)('bloqueia %s inclusive após uma prévia elegível', async status => {
    await seed(); expect((await listManagedMeetings())[0]!.deleteReason).toBeNull();
    const db = await openDatabase(); const tx = db.transaction('jobs', 'readwrite'); const done = transactionDone(tx); tx.objectStore('jobs').put({ ...completeJob('transcribe:chunk-1', 'TRANSCRIBE_CHUNK'), status }); await done; db.close();
    await expect(mutateMeeting('recording', 'DELETE_RECORDING')).rejects.toThrow(); expect(await wasRecordingDeleted('recording')).toBe(false); expect(await getRecording('recording')).toBeDefined();
  });
  it('protege captura e retry automático; permite falha terminal encerrada', async () => {
    await seed({ job: { status: 'ERROR', errorKind: 'RETRYABLE', attempts: 1 } });
    await expect(mutateMeeting('recording', 'DELETE_RECORDING')).rejects.toThrow();
    expect(deletionReason({ ...analysisRecording(), status: 'RECORDING' }, [])).toContain('Finalize');
    const db = await openDatabase(); const tx = db.transaction('jobs', 'readwrite'); const done = transactionDone(tx); tx.objectStore('jobs').put({ ...completeJob('transcribe:chunk-1', 'TRANSCRIBE_CHUNK'), status: 'ERROR', errorKind: 'PERMANENT' }); await done; db.close();
    await mutateMeeting('recording', 'DELETE_RECORDING'); expect(await wasRecordingDeleted('recording')).toBe(true);
  });
  it('falha no meio da cascata reverte marcador, conteúdo e filas juntos', async () => {
    await seed({ fragments: true });
    const original = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key) { if (this.name === 'results') throw new DOMException('fixture abort', 'UnknownError'); return original.call(this, key); });
    await expect(mutateMeeting('recording', 'DELETE_RECORDING')).rejects.toThrow('fixture abort');
    expect(await wasRecordingDeleted('recording')).toBe(false); expect(await getNotes('recording')).toBeDefined(); expect((await getChunk('chunk-1'))!.blob.size).toBe(5); expect(await listJobs('recording')).toHaveLength(2);
  });
  it('duas exclusões concorrentes são idempotentes e sobrevivem à reabertura', async () => {
    await seed(); const outcomes = await Promise.all([mutateMeeting('recording', 'DELETE_RECORDING'), mutateMeeting('recording', 'DELETE_RECORDING')]);
    expect(outcomes.map(result => result.removedAudioBytes).sort()).toEqual([0, 5]);
    const db = await openDatabase(); db.close(); expect(await wasRecordingDeleted('recording')).toBe(true); expect(await listManagedMeetings()).toEqual([]);
  });
  it('respostas e gravações atrasadas não recriam conteúdo nem retomam jobs', async () => {
    await seed(); await mutateMeeting('recording', 'DELETE_RECORDING');
    await expect(updateRecording({ ...analysisRecording(), status: 'COMPLETED' })).rejects.toThrow('excluída');
    await expect(createRecording(analysisRecording())).rejects.toThrow('excluída');
    await expect(commitChunk(makeChunk())).rejects.toThrow('excluída');
    await expect(addFragment({ id: 'late', recordingId: 'recording', recorderId: 'late', sequence: 1, blob: new Blob(['x']) })).rejects.toThrow('excluída');
    expect(await persistTranscript('transcribe:chunk-1', 'old', 1, makeTranscript())).toBe(false);
    expect(await persistNotes('old', 'old', 1, notesOutput(), 'key')).toBe(false); expect(await saveRemoteFile('transcribe:chunk-1', 'old', 1, { name: 'files/late', uri: '', mimeType: 'audio/webm' })).toBe(false);
    expect(await retryAnalysis('recording')).toBe(0); expect(await retryFailedTranscriptions('recording')).toBe(0); expect(await claimJob('worker')).toBeNull();
    expect(await listTranscripts('recording')).toEqual([]);
  });
  it('mantém limpeza remota pendente operável após remover a reunião', async () => {
    await seed({ pendingCleanup: true }); const result = await mutateMeeting('recording', 'DELETE_RECORDING');
    expect(result.cleanupPending).toBe(true); expect(await cleanupSummary()).toEqual({ pending: 1, failed: 0, waitingForCredentials: 0 });
    const job = await claimJob('cleanup-worker'); expect(job?.kind).toBe('DELETE_REMOTE_FILE');
    expect(await markRemoteDeleted(job!.chunkId, job!.id, 'cleanup-worker', job!.generation)).toBe(true);
    expect(await getRecording('recording')).toBeUndefined(); expect(await cleanupSummary()).toEqual({ pending: 0, failed: 0, waitingForCredentials: 0 }); expect(await listJobs('recording')).toEqual([]);
  });
  it('cria limpeza durável para identidade remota conhecida ainda sem job de limpeza', async () => {
    await seed({ job: { remoteFile: { name: 'files/known-orphan', uri: 'fixture', mimeType: 'audio/webm' } } });
    await mutateMeeting('recording', 'DELETE_RECORDING'); const jobs = await listJobs('recording'); expect(jobs).toHaveLength(1); expect(jobs[0]).toMatchObject({ kind: 'DELETE_REMOTE_FILE', status: 'PENDING', remoteFile: { name: 'files/known-orphan' } });
  });
  it('o marcador barra até um job obsoleto com lease aparentemente válida; upload tardio ainda recebe limpeza', async () => {
    await seed(); await mutateMeeting('recording', 'DELETE_RECORDING');
    const stale = { ...completeJob('transcribe:chunk-1', 'TRANSCRIBE_CHUNK'), status: 'PROCESSING' as const, leaseOwner: 'late-worker', leaseExpiresAt: Date.now() + 60000, generation: 7 };
    const db = await openDatabase(); const tx = db.transaction('jobs', 'readwrite'); const done = transactionDone(tx); tx.objectStore('jobs').put(stale); await done; db.close();
    expect(await persistTranscript(stale.id, 'late-worker', 7, makeTranscript())).toBe(false);
    expect(await renewJobLease(stale.id, 'late-worker', 7)).toBe(false);
    expect(await reserveTranscription(stale.id, 'late-worker', 7)).toBe('STALE');
    expect(await failJob(stale.id, 'late-worker', 7, { kind: 'RETRYABLE', message: 'late' })).toBe(false);
    expect(await saveRemoteFile(stale.id, 'late-worker', 7, { name: 'files/late', uri: '', mimeType: 'audio/webm' })).toBe(false);
    expect(await claimJob('another-worker', Date.now() + 120000)).toBeNull();
    await enqueueOrphanCleanup('recording', 'chunk-1', { name: 'files/late', uri: '', mimeType: 'audio/webm' });
    expect((await claimJob('cleanup-worker'))?.kind).toBe('DELETE_REMOTE_FILE'); expect(await listTranscripts('recording')).toEqual([]);
  });
});

it('migra v4→v5 sem substituir dados existentes', async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 4); r.onerror = () => reject(r.error);
    r.onupgradeneeded = () => { r.result.createObjectStore('recordings', { keyPath: 'id' }).put(analysisRecording()); r.result.createObjectStore('results', { keyPath: 'recordingId' }).put(meetingNotes()); };
    r.onsuccess = () => { r.result.close(); resolve(); };
  });
  const db = await openDatabase(); expect(db.version).toBe(5); expect(db.objectStoreNames.contains('meetingDeletions')).toBe(true); db.close();
  expect(await getRecording('recording')).toEqual(analysisRecording()); expect(await getNotes('recording')).toEqual(meetingNotes());
});
