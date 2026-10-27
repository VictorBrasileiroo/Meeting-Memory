import type { MeetingNotes } from '../domain/notes';
import { profiles } from '../domain/profiles';
import { openDatabase, type Recording } from '../storage/recordings';
import { meetingTitle } from './session-data';

export type MeetingChoice = {
  id: string;
  title: string;
  profile: string;
  createdAt: number;
  status: string;
  tone: 'neutral' | 'success' | 'warning' | 'error';
};

export function meetingChoice(recording: Recording, notes?: MeetingNotes, id = recording.id): MeetingChoice {
  let status = 'Sem notas';
  let tone: MeetingChoice['tone'] = 'neutral';
  if (recording.interruption || recording.completeness === 'PARTIAL') { status = 'Interrompida'; tone = 'warning'; }
  else if (notes) { status = 'Notas prontas'; tone = 'success'; }
  else if (recording.status === 'RECORDING') status = 'Gravando';
  else if (recording.status === 'STARTING') status = 'Preparando gravação';
  else if (recording.status === 'STOPPING') status = 'Finalizando gravação';
  else if (recording.status === 'PROCESSING') status = 'Processando';
  else if (recording.status === 'ERROR') { status = 'Precisa de atenção'; tone = 'error'; }
  return { id, title: meetingTitle(recording, notes), profile: profiles[recording.profile].label, createdAt: recording.createdAt, status, tone };
}

// The existing schema has no separate title index. Read results only when the
// picker opens, retain just the title/presence, and never read audio or sources.
export async function listMeetingChoices(): Promise<MeetingChoice[]> {
  const db = await openDatabase();
  try {
    return await new Promise<MeetingChoice[]>((resolve, reject) => {
      const rows: MeetingChoice[] = [];
      const tx = db.transaction(['recordings', 'results'], 'readonly');
      const request = tx.objectStore('recordings').openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const recording = cursor.value as Recording;
        const result = tx.objectStore('results').get(recording.id);
        result.onsuccess = () => { rows.push(meetingChoice(recording, result.result as MeetingNotes | undefined)); cursor.continue(); };
      };
      tx.oncomplete = () => resolve(rows.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)));
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Não foi possível ler as reuniões salvas.'));
    });
  } finally { db.close(); }
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
const searchTexts = new WeakMap<MeetingChoice, string>();

export function filterMeetingChoices(choices: readonly MeetingChoice[], query: string): MeetingChoice[] {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return choices.filter(choice => {
    let text = searchTexts.get(choice);
    if (text === undefined) {
      const date = new Date(choice.createdAt);
      text = normalize([choice.title, choice.profile, date.toLocaleDateString('pt-BR'), date.toLocaleDateString('pt-BR', { dateStyle: 'long' })].join(' '));
      searchTexts.set(choice, text);
    }
    return terms.every(term => text.includes(term));
  });
}

export function meetingLocation(currentHref: string, id: string, preview = false): string {
  const url = new URL(currentHref);
  url.searchParams.set(preview ? 'scenario' : 'recordingId', id);
  url.hash = 'notes';
  return url.href;
}
