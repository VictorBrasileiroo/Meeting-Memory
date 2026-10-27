import { initialSnapshot, snapshotSchema, type Snapshot } from '../domain/contracts';
import { transition, type RecordingEvent } from '../domain/recording-state';
import type { Request } from '../messaging/protocol';

export const SNAPSHOT_KEY = 'foundation-snapshot-v1';
export class FoundationError extends Error {
  constructor(public code: 'MOCK_DISABLED' | 'CONFLICT' | 'INVALID_TRANSITION', message: string) { super(message); }
}
export function reconcileSnapshot(raw: unknown, mockEnabled: boolean): Snapshot {
  if (!mockEnabled) return initialSnapshot();
  const parsed = snapshotSchema.safeParse(raw);
  return parsed.success && parsed.data.mode === 'mock' ? parsed.data : initialSnapshot('mock');
}
export function applyRequest(snapshot: Snapshot, request: Request, mockEnabled: boolean, now: number, newId: string): Snapshot {
  if (request.type === 'GET_SNAPSHOT') return snapshot;
  if (request.type === 'START_CAPTURE' || request.type === 'STOP_CAPTURE' || request.type === 'RESET_CAPTURE' || request.type === 'RECOVER_CAPTURE' || request.type === 'RETRY_TRANSCRIPTION' || request.type === 'RETRY_ANALYSIS' || request.type === 'PROBE_ANALYSIS') {
    throw new FoundationError('INVALID_TRANSITION', 'Comando de captura real fora da simulação.');
  }
  if (!mockEnabled) throw new FoundationError('MOCK_DISABLED', 'Gravação indisponível neste bloco. Nenhum áudio foi capturado.');
  if (request.expectedRevision !== snapshot.revision || request.recordingId !== snapshot.recordingId) {
    throw new FoundationError('CONFLICT', 'O estado mudou em outra janela. Atualize antes de continuar.');
  }
  if (request.type === 'RESET_MOCK') return { ...initialSnapshot('mock'), revision: snapshot.revision + 1 };
  let event: RecordingEvent;
  switch (request.type) {
    case 'START_MOCK': event = { type: 'START_REQUESTED' }; break;
    case 'STOP_MOCK': event = { type: 'STOP_REQUESTED' }; break;
    case 'RECOVER_MOCK': event = { type: 'RECOVER_PROCESSING' }; break;
    case 'FAIL_MOCK': event = { type: 'FAILURE', failure: {
      phase: snapshot.status === 'PROCESSING' ? 'processing' : 'capture',
      message: 'Falha simulada para verificar a apresentação do erro. Nenhum áudio foi capturado.',
      recoverable: snapshot.status === 'PROCESSING', hasRecoverableData: snapshot.status === 'PROCESSING',
    } }; break;
    case 'ADVANCE_MOCK': {
      const next: Partial<Record<Snapshot['status'], RecordingEvent['type']>> = { STARTING: 'CAPTURE_READY', STOPPING: 'CAPTURE_COMMITTED', PROCESSING: 'COMPLETE' };
      const type = next[snapshot.status];
      if (!type || type === 'FAILURE') throw new FoundationError('INVALID_TRANSITION', 'Esta etapa não pode avançar na simulação.');
      event = { type }; break;
    }
  }
  const machine = transition({ status: snapshot.status, failure: snapshot.failure }, event);
  return snapshotSchema.parse({
    ...snapshot, ...machine, mode: 'mock', revision: snapshot.revision + 1,
    recordingId: request.type === 'START_MOCK' ? newId : snapshot.recordingId,
    profile: request.type === 'START_MOCK' ? request.payload.profile : snapshot.profile,
    startedAt: machine.status === 'RECORDING' ? now : snapshot.startedAt,
    endedAt: machine.status === 'PROCESSING' && snapshot.status === 'STOPPING' ? Math.max(now, snapshot.startedAt ?? now) : snapshot.endedAt,
  });
}
