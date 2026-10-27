import { openDatabase, type Recording, type Chunk, type Job, type TranscriptChunk, type RemoteFile } from './recordings';
import type { MeetingNotes } from '../domain/notes';
import { meetingChoice, type MeetingChoice } from '../session/meeting-choices';
import { isTerminalJob } from '../queue/job-policy';

export type MeetingDeletion = { recordingId: string; deletedAt: number };
export type MeetingSize = { audioBytes: number; fragmentBytes: number; textBytes: number; metadataBytes: number };
export type ManagedMeeting = MeetingChoice & {
  recording: Recording; hasNotes: boolean; transcriptCount: number;
  size: MeetingSize | null; deleteReason: string | null; audioReason: string | null;
};
export type ManagementAction = 'REMOVE_RECORDING_AUDIO' | 'DELETE_RECORDING';
export type ManagementResult = { recordingId: string; type: ManagementAction; removedAudioBytes: number; cleanupPending: boolean };
export type CleanupSummary = { pending: number; failed: number; waitingForCredentials: number };
export class MeetingManagementError extends Error {}
export const idbRequest = <T,>(r: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error ?? new Error('Falha ao ler o armazenamento.')); });
export const transactionDone = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('A operação no armazenamento não foi concluída.')); });

export function deletionReason(recording: Recording, jobs: readonly Job[]): string | null {
  if (['STARTING', 'RECORDING', 'STOPPING'].includes(recording.status)) return 'Finalize a gravação antes de gerenciar esta reunião.';
  const content = jobs.filter(job => job.kind !== 'DELETE_REMOTE_FILE');
  if (content.some(job => job.status === 'WAITING_FOR_CREDENTIALS')) return 'O processamento aguarda credenciais. Revise a chave nas configurações.';
  if (content.some(job => !isTerminalJob(job) || (job.leaseExpiresAt !== null && job.leaseExpiresAt > Date.now()))) return 'Aguarde o processamento ou a nova tentativa automática terminar.';
  // A finished transcription may be about to enqueue its analysis.
  if (recording.status === 'PROCESSING' && !content.some(job => job.status === 'ERROR' && isTerminalJob(job))) return 'Aguarde a conclusão do processamento.';
  return null;
}

type Scan = MeetingSize & { retained: Set<string>; transcribed: Set<string>; transcribeDone: Set<string>; cleanupDone: Set<string>; cleanupIncomplete: boolean };
const emptyScan = (): Scan => ({ audioBytes: 0, fragmentBytes: 0, textBytes: 0, metadataBytes: 0, retained: new Set(), transcribed: new Set(), transcribeDone: new Set(), cleanupDone: new Set(), cleanupIncomplete: false });
const encodedSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function accumulate(state: Scan, store: string, value: Record<string, unknown>) {
  if (store === 'chunks' || store === 'fragments') {
    const { blob, ...metadata } = value;
    const bytes = blob instanceof Blob ? blob.size : 0;
    state.audioBytes += bytes; state.metadataBytes += encodedSize(metadata);
    if (store === 'fragments') state.fragmentBytes += bytes;
    else if (bytes) state.retained.add(String(value.id));
  } else if (store === 'transcripts') {
    const t = value as unknown as TranscriptChunk;
    const { rawText, annotations, speakers, ...metadata } = t;
    state.textBytes += encodedSize({ rawText, annotations, speakers }); state.metadataBytes += encodedSize(metadata);
    if (t.remoteDeleteStatus === 'DELETED') state.transcribed.add(t.chunkId);
  } else if (store === 'results') state.textBytes += encodedSize(value);
  else {
    state.metadataBytes += encodedSize(value);
    if (store === 'jobs') {
      const job = value as unknown as Job;
      if (job.kind === 'TRANSCRIBE_CHUNK' && job.status === 'COMPLETE') state.transcribeDone.add(job.chunkId);
      if (job.kind === 'DELETE_REMOTE_FILE') {
        if (job.status === 'COMPLETE' && job.id === `delete:${job.chunkId}`) state.cleanupDone.add(job.chunkId);
        if (job.status !== 'COMPLETE') state.cleanupIncomplete = true;
      }
    }
  }
}
function audioReason(state: Scan, blocked: string | null): string | null {
  if (blocked) return blocked;
  if (!state.audioBytes) return 'Não há áudio local para remover.';
  if (state.fragmentBytes) return 'Há fragmentos de captura preservados. A remoção exclusiva de áudio está protegida.';
  if (state.cleanupIncomplete || [...state.retained].some(id => !state.transcribed.has(id) || !state.transcribeDone.has(id) || !state.cleanupDone.has(id))) return 'O áudio só pode ser removido após salvar a transcrição e concluir a limpeza remota de todas as partes.';
  return null;
}

export async function listManagedMeetings(): Promise<ManagedMeeting[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['recordings', 'results', 'jobs', 'transcripts', 'meetingDeletions'], 'readonly'); const done = transactionDone(tx); void done.catch(() => undefined);
    const rows: ManagedMeeting[] = [];
    await new Promise<void>((resolve, reject) => {
      const r = tx.objectStore('recordings').openCursor(); r.onerror = () => reject(r.error);
      r.onsuccess = () => { const cursor = r.result; if (!cursor) { resolve(); return; }
        void (async () => {
          const recording = cursor.value as Recording;
          if (!await idbRequest(tx.objectStore('meetingDeletions').get(recording.id))) {
            const notes = await idbRequest(tx.objectStore('results').get(recording.id)) as MeetingNotes | undefined;
            const jobs = await idbRequest(tx.objectStore('jobs').index('recordingId').getAll(recording.id)) as Job[];
            const transcriptCount = await idbRequest(tx.objectStore('transcripts').index('recordingId').count(recording.id));
            rows.push({ ...meetingChoice(recording, notes), recording, hasNotes: Boolean(notes), transcriptCount, size: null, deleteReason: deletionReason(recording, jobs), audioReason: 'Aguarde a medição do áudio.' });
          }
          cursor.continue();
        })().catch(reject);
      };
    });
    await done; return rows.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  } finally { db.close(); }
}

// At most 100 records per readonly transaction. Blob handles are inspected only
// via .size; no arrayBuffer(), decoding, getAll(chunks), or library-sized arrays.
export async function measureMeetings(rows: readonly ManagedMeeting[], onProgress: (records: number) => void, signal?: AbortSignal): Promise<{ rows: ManagedMeeting[]; unassociatedAudioBytes: number }> {
  const states = new Map(rows.map(row => [row.id, emptyScan()])); let unassociatedAudioBytes = 0; let records = 0;
  const db = await openDatabase();
  try {
    for (const name of ['recordings', 'chunks', 'fragments', 'transcripts', 'results', 'jobs']) {
      let after: IDBValidKey | undefined;
      let more = true;
      while (more) {
        signal?.throwIfAborted();
        const tx = db.transaction(name, 'readonly'); const done = transactionDone(tx); void done.catch(() => undefined);
        let count = 0;
        await new Promise<void>((resolve, reject) => {
          const r = tx.objectStore(name).openCursor(after === undefined ? undefined : IDBKeyRange.lowerBound(after, true));
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const cursor = r.result; if (!cursor) { more = false; resolve(); return; }
            if (signal?.aborted) { reject(signal.reason); return; }
            const value = cursor.value as Record<string, unknown>;
            const id = name === 'recordings' ? String(value.id) : String(value.recordingId);
            const state = states.get(id);
            if (state) accumulate(state, name, value);
            else if ((name === 'chunks' || name === 'fragments') && value.blob instanceof Blob) unassociatedAudioBytes += value.blob.size;
            records++; count++; after = cursor.primaryKey;
            if (count === 100) resolve(); else cursor.continue();
          };
        });
        await done; onProgress(records);
      }
    }
    signal?.throwIfAborted();
    return { rows: rows.map(row => { const state = states.get(row.id)!; const { audioBytes, fragmentBytes, textBytes, metadataBytes } = state; return { ...row, size: { audioBytes, fragmentBytes, textBytes, metadataBytes }, audioReason: audioReason(state, row.deleteReason) }; }), unassociatedAudioBytes };
  } finally { db.close(); }
}

async function walk(tx: IDBTransaction, store: string, recordingId: string, visitor: (cursor: IDBCursorWithValue) => void): Promise<void> {
  const object = tx.objectStore(store);
  const source = object.indexNames.contains('recordingId') ? object.index('recordingId') : object;
  await new Promise<void>((resolve, reject) => {
    const r = source.openCursor(source instanceof IDBIndex ? IDBKeyRange.only(recordingId) : undefined);
    r.onerror = () => reject(r.error); r.onsuccess = () => {
      const c = r.result; if (!c) { resolve(); return; }
      try { if ((c.value as { recordingId?: string }).recordingId === recordingId) visitor(c); c.continue(); } catch (error) { reject(error); }
    };
  });
}

export async function mutateMeeting(recordingId: string, type: ManagementAction): Promise<ManagementResult> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['recordings', 'activeSession', 'chunks', 'fragments', 'jobs', 'transcripts', 'results', 'meetingDeletions'], 'readwrite');
    const done = transactionDone(tx); void done.catch(() => undefined);
    try {
      const deleted = await idbRequest(tx.objectStore('meetingDeletions').get(recordingId));
      if (deleted) {
        const cleanups = await idbRequest(tx.objectStore('jobs').index('recordingId').getAll(recordingId)) as Job[];
        await done;
        if (type === 'DELETE_RECORDING') return { recordingId, type, removedAudioBytes: 0, cleanupPending: cleanups.some(job => job.kind === 'DELETE_REMOTE_FILE' && job.status !== 'COMPLETE') };
        throw new MeetingManagementError('Esta reunião foi excluída em outra página.');
      }
      const recording = await idbRequest(tx.objectStore('recordings').get(recordingId)) as Recording | undefined;
      if (!recording) throw new MeetingManagementError('Reunião não encontrada. Atualize a lista.');
      const jobs = await idbRequest(tx.objectStore('jobs').index('recordingId').getAll(recordingId)) as Job[];
      const blocked = deletionReason(recording, jobs); if (blocked) throw new MeetingManagementError(blocked);
      const state = emptyScan();
      for (const name of ['chunks', 'fragments', 'transcripts', 'jobs']) await walk(tx, name, recordingId, cursor => accumulate(state, name, cursor.value as Record<string, unknown>));
      if (type === 'REMOVE_RECORDING_AUDIO') {
        const reason = audioReason(state, blocked); if (reason) throw new MeetingManagementError(reason);
        await walk(tx, 'chunks', recordingId, cursor => { const chunk = cursor.value as Chunk; if (chunk.blob.size) cursor.update({ ...chunk, blob: new Blob([], { type: chunk.mimeType }) }); });
        tx.objectStore('recordings').put({ ...recording, revision: recording.revision + 1 });
        await done; return { recordingId, type, removedAudioBytes: state.audioBytes, cleanupPending: false };
      }
      // Marker, cleanup identities, cascades and active ID all commit together.
      // All writers/claimers share the meetingDeletions transaction lock.
      tx.objectStore('meetingDeletions').put({ recordingId, deletedAt: Date.now() } satisfies MeetingDeletion);
      const known = new Map<string, { remote: RemoteFile; chunkId: string }>();
      const retained = new Set(jobs.filter(job => job.kind === 'DELETE_REMOTE_FILE' && job.remoteFile).map(job => job.remoteFile!.name));
      for (const job of jobs) if (job.remoteFile && job.kind !== 'DELETE_REMOTE_FILE') known.set(job.remoteFile.name, { remote: job.remoteFile, chunkId: job.chunkId });
      await walk(tx, 'transcripts', recordingId, cursor => { const t = cursor.value as TranscriptChunk; if (t.remoteDeleteStatus !== 'DELETED' && t.remoteFileName) known.set(t.remoteFileName, { remote: { name: t.remoteFileName, uri: '', mimeType: t.sourceMimeType }, chunkId: t.chunkId }); });
      let cleanupPending = jobs.some(job => job.kind === 'DELETE_REMOTE_FILE' && job.status !== 'COMPLETE');
      for (const [name, item] of known) if (!retained.has(name)) {
        tx.objectStore('jobs').put({ id: `delete-meeting:${crypto.randomUUID()}`, kind: 'DELETE_REMOTE_FILE', recordingId, chunkId: item.chunkId, status: 'PENDING', attempts: 0, nextAttemptAt: 0, leaseOwner: null, leaseExpiresAt: null, generation: 0, lastError: null, errorKind: null, remoteFile: item.remote } satisfies Job); cleanupPending = true;
      }
      for (const name of ['chunks', 'fragments', 'transcripts']) await walk(tx, name, recordingId, cursor => { cursor.delete(); });
      for (const job of jobs) if (job.kind !== 'DELETE_REMOTE_FILE' || job.status === 'COMPLETE') tx.objectStore('jobs').delete(job.id);
      tx.objectStore('results').delete(recordingId); tx.objectStore('recordings').delete(recordingId);
      if (await idbRequest(tx.objectStore('activeSession').get('current')) === recordingId) tx.objectStore('activeSession').delete('current');
      await done; return { recordingId, type, removedAudioBytes: state.audioBytes, cleanupPending };
    } catch (error) { try { tx.abort(); } catch { /* Already rolled back. */ } await done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}

export async function cleanupSummary(): Promise<CleanupSummary> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['jobs', 'meetingDeletions'], 'readonly'); const done = transactionDone(tx); void done.catch(() => undefined);
    const summary: CleanupSummary = { pending: 0, failed: 0, waitingForCredentials: 0 };
    await new Promise<void>((resolve, reject) => {
      const r = tx.objectStore('jobs').openCursor(); r.onerror = () => reject(r.error);
      r.onsuccess = () => { const c = r.result; if (!c) { resolve(); return; } void (async () => {
        const job = c.value as Job;
        if (job.kind === 'DELETE_REMOTE_FILE' && job.status !== 'COMPLETE' && await idbRequest(tx.objectStore('meetingDeletions').get(job.recordingId))) {
          if (job.status === 'WAITING_FOR_CREDENTIALS') summary.waitingForCredentials++;
          else if (isTerminalJob(job)) summary.failed++; else summary.pending++;
        }
        c.continue();
      })().catch(reject); };
    }); await done; return summary;
  } finally { db.close(); }
}
