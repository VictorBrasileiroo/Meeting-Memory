import { cleanupSummary, listManagedMeetings, measureMeetings, type ManagedMeeting, type ManagementAction, type ManagementResult, type CleanupSummary } from '../storage/meeting-management';
import { manageMeeting } from '../messaging/management-client';

export type LibrarySource = {
  estimate?: () => Promise<{ usage: number; quota: number }>;
  list: () => Promise<ManagedMeeting[]>;
  measure: (rows: readonly ManagedMeeting[], progress: (records: number) => void, signal?: AbortSignal) => Promise<{ rows: ManagedMeeting[]; unassociatedAudioBytes: number }>;
  mutate: (id: string, type: ManagementAction) => Promise<ManagementResult>;
  cleanup: () => Promise<CleanupSummary>;
};
export async function librarySource(): Promise<LibrarySource> {
  if (__FOUNDATION_MOCK__) return (await import('./library-fixtures')).fixtureSource();
  return { list: listManagedMeetings, measure: measureMeetings, mutate: manageMeeting, cleanup: cleanupSummary };
}
