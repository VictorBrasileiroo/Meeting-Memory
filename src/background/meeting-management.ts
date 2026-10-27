import { notifyMeetingChange } from '../storage/meeting-events';
import { initialSnapshot } from '../domain/contracts';
import type { ManagementRequest, ManagementResponse } from '../messaging/management-protocol';
import { MeetingManagementError, mutateMeeting } from '../storage/meeting-management';
import { readCaptureSnapshot, saveCaptureSnapshot, ensureOffscreen } from './capture-coordinator';
import { wasRecordingDeleted } from '../storage/recordings';

// Called only through the service worker's existing serialized command queue.
export async function handleManagementRequest(request: ManagementRequest): Promise<ManagementResponse> {
  const reply = { protocolVersion: 1 as const, requestId: request.requestId };
  try {
    const snapshot = await readCaptureSnapshot();
    if (request.expectedRevision !== snapshot.revision) return { ...reply, ok: false, code: 'CONFLICT', message: 'O estado mudou. Atualize a lista e confirme novamente.' };
    if (snapshot.recordingId === request.recordingId && ['STARTING', 'RECORDING', 'STOPPING', 'PROCESSING'].includes(snapshot.status) && !await wasRecordingDeleted(request.recordingId)) return { ...reply, ok: false, code: 'PROTECTED', message: 'Aguarde a gravação e o processamento desta reunião terminarem.' };
    const result = await mutateMeeting(request.recordingId, request.type);
    if (request.type === 'DELETE_RECORDING' && snapshot.recordingId === request.recordingId) {
      // IDB and chrome.storage cannot share a transaction. A durable tombstone
      // also repairs this snapshot on the next GET if the worker stops here.
      await saveCaptureSnapshot({ ...initialSnapshot('capture'), revision: snapshot.revision + 1 }).catch(() => undefined);
    }
    notifyMeetingChange({ recordingId: request.recordingId, type: request.type });
    if (result.cleanupPending) await ensureOffscreen(true).catch(() => undefined);
    return { ...reply, ok: true, result };
  } catch (error) {
    return { ...reply, ok: false, code: error instanceof MeetingManagementError ? 'PROTECTED' : 'STORAGE_FAILURE', message: error instanceof MeetingManagementError ? error.message : 'Não foi possível concluir a limpeza. Atualize a lista e tente novamente.' };
  }
}
