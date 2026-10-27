export type SessionTab = 'notes' | 'transcript' | 'audio';
export function readSessionLocation(hash: string): { tab: SessionTab; target?: string } {
  let value: string;
  try { value = decodeURIComponent(hash.replace(/^#/, '')); } catch { return { tab: 'notes' }; }
  if (value.startsWith('source-')) return { tab: 'transcript', target: value };
  if (value.startsWith('notes-')) return { tab: 'notes', target: value };
  return { tab: value === 'audio' || value === 'transcript' ? value : 'notes' };
}
