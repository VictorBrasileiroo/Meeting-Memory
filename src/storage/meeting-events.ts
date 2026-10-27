export const MEETING_CHANNEL = 'meeting-memory-content-changed';
export type MeetingChange = { recordingId: string; type: 'REMOVE_RECORDING_AUDIO' | 'DELETE_RECORDING' };
export function notifyMeetingChange(change: MeetingChange) {
  if (typeof BroadcastChannel === 'undefined') return;
  try { const channel = new BroadcastChannel(MEETING_CHANNEL); channel.postMessage(change); channel.close(); } catch { /* Polling also reconciles open sessions. */ }
}
export function onMeetingChange(listener: (change: MeetingChange) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel(MEETING_CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const value = event.data as Partial<MeetingChange> | null;
    if (value && typeof value.recordingId === 'string' && (value.type === 'REMOVE_RECORDING_AUDIO' || value.type === 'DELETE_RECORDING')) listener(value as MeetingChange);
  };
  return () => channel.close();
}
