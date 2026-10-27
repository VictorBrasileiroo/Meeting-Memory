import { openDatabase, type Recording, type Job, type TranscriptChunk } from '../storage/recordings';
import type { MeetingNotes } from '../domain/notes';
import { profiles } from '../domain/profiles';
import { isTerminalJob } from '../queue/job-policy';

export type PartReference = { id: string; index: number };
export type SessionData = { recording: Recording | undefined; notes: MeetingNotes | undefined; jobs: Job[]; transcripts: TranscriptChunk[]; parts: PartReference[] };

// Read only index keys: listing a meeting must not materialize its audio Blobs.
// The existing v4 compound index carries the real part number and primary key.
export async function listPartReferences(recordingId: string): Promise<PartReference[]> {
  const db = await openDatabase();
  try {
    return await new Promise<PartReference[]>((resolve, reject) => {
      const tx = db.transaction('chunks', 'readonly');
      const rows: PartReference[] = [];
      const cursor = tx.objectStore('chunks').index('recordingIndex').openKeyCursor(IDBKeyRange.bound([recordingId, 0], [recordingId, Infinity]));
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const key = current.key as [string, number];
        rows.push({ id: String(current.primaryKey), index: key[1] });
        current.continue();
      };
      tx.oncomplete = () => resolve(rows);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Não foi possível ler as partes salvas.'));
    });
  } finally { db.close(); }
}

export function meetingTitle(recording: Pick<Recording, 'profile' | 'createdAt'>, notes?: MeetingNotes): string {
  return notes?.output.title?.trim() || `${profiles[recording.profile].label} · ${new Date(recording.createdAt).toLocaleDateString('pt-BR')}`;
}

export function sessionPhase(data: SessionData, now = Date.now()): { label: string; tone: 'neutral' | 'success' | 'warning' | 'error'; description: string } {
  const { recording, notes, jobs, transcripts, parts } = data;
  if (recording?.interruption || recording?.completeness === 'PARTIAL') return { label: 'Gravação interrompida', tone: 'warning', description: 'A transcrição disponível cobre somente as partes recuperadas. Nenhuma análise parcial é feita automaticamente.' };
  if (notes) return { label: 'Notas prontas', tone: 'success', description: 'Notas geradas a partir da transcrição preservada.' };
  if (recording && ['STARTING', 'RECORDING', 'STOPPING'].includes(recording.status)) return { label: recording.status === 'STOPPING' ? 'Salvando última parte' : recording.status === 'STARTING' ? 'Preparando gravação' : 'Gravação em andamento', tone: 'neutral', description: 'As partes já salvas continuam disponíveis para consulta.' };
  const work = jobs.filter(job => job.kind !== 'DELETE_REMOTE_FILE' && job.status !== 'COMPLETE');
  if (work.some(job => job.status === 'WAITING_FOR_CREDENTIALS')) return { label: 'Configure sua chave Gemini', tone: 'warning', description: 'O processamento aguarda credenciais. Abra as configurações para revisar sua chave.' };
  if (work.some(job => isTerminalJob(job))) return { label: 'O processamento precisa de atenção', tone: 'error', description: 'O material salvo continua disponível. Consulte os detalhes para ver as opções de recuperação.' };
  if (work.some(job => job.nextAttemptAt > now && /429|quota|rate|limite/i.test(job.lastError ?? ''))) return { label: 'Aguardando limite da API', tone: 'warning', description: 'Uma nova tentativa será feita automaticamente quando a espera terminar.' };
  if (work.some(job => job.status === 'ERROR')) return { label: 'Aguardando nova tentativa', tone: 'warning', description: 'Houve uma falha recuperável. O processamento será repetido automaticamente.' };
  if (work.some(job => job.analysisProbe && !job.analysisProbe.done)) return { label: 'Teste técnico em andamento', tone: 'neutral', description: 'O teste usa texto fictício e não gera notas. A transcrição desta reunião está preservada.' };
  if (work.some(job => job.kind === 'ANALYZE_RECORDING' && job.status === 'PROCESSING')) return { label: 'Gerando notas', tone: 'neutral', description: 'A transcrição está salva. As notas aparecerão quando a análise for salva.' };
  if (recording?.status === 'ERROR') return { label: 'O processamento precisa de atenção', tone: 'error', description: 'O material salvo continua disponível. Consulte os detalhes para ver as opções de recuperação.' };
  if (!recording?.analysisModel) return { label: 'Transcrição preservada', tone: 'neutral', description: 'Esta sessão anterior não tem notas. A geração automática está disponível para novas gravações.' };
  if (work.length || recording.status === 'PROCESSING') return { label: parts.length > 0 && transcripts.length === parts.length ? 'Preparando análise' : 'Transcrevendo partes', tone: 'neutral', description: 'Você pode consultar o texto das partes já transcritas.' };
  return { label: recording.status === 'ERROR' ? 'O processamento precisa de atenção' : 'Sessão sem notas', tone: recording.status === 'ERROR' ? 'error' : 'neutral', description: 'Consulte a transcrição e as partes disponíveis desta sessão.' };
}
