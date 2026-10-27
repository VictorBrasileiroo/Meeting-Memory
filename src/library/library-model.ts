import { filterMeetingChoices } from '../session/meeting-choices';
import type { ManagedMeeting } from '../storage/meeting-management';

export type LibraryState = { q: string; status: string; audio: 'all' | 'with' | 'without'; sort: 'newest' | 'oldest' | 'largest'; page: number };
export const PAGE_SIZE = 30;
export function readLibraryState(search: string): LibraryState {
  const p = new URLSearchParams(search); const page = Number(p.get('page'));
  return { q: p.get('q') ?? '', status: p.get('status') ?? 'all', audio: p.get('audio') === 'with' ? 'with' : p.get('audio') === 'without' ? 'without' : 'all', sort: p.get('sort') === 'oldest' ? 'oldest' : p.get('sort') === 'largest' ? 'largest' : 'newest', page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
}
export function librarySearch(state: LibraryState): string {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q); if (state.status !== 'all') p.set('status', state.status); if (state.audio !== 'all') p.set('audio', state.audio); if (state.sort !== 'newest') p.set('sort', state.sort); if (state.page > 1) p.set('page', String(state.page));
  return p.toString();
}
export const totalBytes = (row: ManagedMeeting) => row.size ? row.size.audioBytes + row.size.textBytes + row.size.metadataBytes : 0;
export function visibleMeetings(rows: readonly ManagedMeeting[], state: LibraryState): ManagedMeeting[] {
  return filterMeetingChoices(rows, state.q).filter((row): row is ManagedMeeting => 'recording' in row)
    .filter(row => (state.status === 'all' || row.status === state.status) && (state.audio === 'all' || (row.size !== null && (state.audio === 'with' ? row.size.audioBytes > 0 : row.size.audioBytes === 0))))
    .sort((a, b) => (state.sort === 'largest' ? totalBytes(b) - totalBytes(a) : state.sort === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt) || a.id.localeCompare(b.id));
}
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Indisponível';
  const units = ['B', 'KiB', 'MiB', 'GiB']; const unit = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: unit ? 1 : 0 }).format(bytes / 1024 ** unit)} ${units[unit]}`;
}
export function meetingHref(id: string, state: LibraryState) {
  const p = new URLSearchParams({ recordingId: id }); const back = librarySearch(state); if (back) p.set('library', back);
  return `../session/session.html?${p}#notes`;
}
export function libraryReturnHref(sessionSearch: string): string {
  const raw = new URLSearchParams(sessionSearch).get('library');
  const back = raw ? librarySearch(readLibraryState(raw)) : '';
  return `../library/library.html${back ? '?' + back : ''}`;
}
