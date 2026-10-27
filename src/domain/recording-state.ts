import { z } from 'zod';

export const RECORDING_STATES = ['IDLE', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING', 'COMPLETED', 'ERROR'] as const;
export const recordingStateSchema = z.enum(RECORDING_STATES);
export type RecordingState = z.infer<typeof recordingStateSchema>;
export const failureSchema = z.strictObject({
  phase: z.enum(['capture', 'processing']),
  message: z.string().min(1).max(300),
  recoverable: z.boolean(),
  hasRecoverableData: z.boolean(),
});
export type Failure = z.infer<typeof failureSchema>;
export type RecordingEvent =
  | { type: 'START_REQUESTED' | 'CAPTURE_READY' | 'STOP_REQUESTED' | 'CAPTURE_COMMITTED' | 'COMPLETE' | 'RECOVER_PROCESSING' }
  | { type: 'FAILURE'; failure: Failure };
export type Machine = { status: RecordingState; failure: Failure | null };

const transitions: Partial<Record<RecordingState, Partial<Record<RecordingEvent['type'], RecordingState>>>> = {
  IDLE: { START_REQUESTED: 'STARTING' },
  STARTING: { CAPTURE_READY: 'RECORDING', FAILURE: 'ERROR' },
  RECORDING: { STOP_REQUESTED: 'STOPPING', FAILURE: 'ERROR' },
  STOPPING: { CAPTURE_COMMITTED: 'PROCESSING', FAILURE: 'ERROR' },
  PROCESSING: { COMPLETE: 'COMPLETED', FAILURE: 'ERROR' },
  ERROR: { RECOVER_PROCESSING: 'PROCESSING' },
};

export class InvalidTransitionError extends Error {
  constructor(status: RecordingState, event: RecordingEvent['type']) {
    super(`Transição inválida: ${status} + ${event}`);
    this.name = 'InvalidTransitionError';
  }
}

export function transition(machine: Machine, event: RecordingEvent): Machine {
  const next = transitions[machine.status]?.[event.type];
  const recoveryAllowed = machine.failure?.phase === 'processing'
    && machine.failure.recoverable && machine.failure.hasRecoverableData;
  if (!next || (event.type === 'RECOVER_PROCESSING' && !recoveryAllowed)) {
    throw new InvalidTransitionError(machine.status, event.type);
  }
  if (event.type === 'FAILURE') {
    const expectedPhase = machine.status === 'PROCESSING' ? 'processing' : 'capture';
    if (event.failure.phase !== expectedPhase) throw new InvalidTransitionError(machine.status, event.type);
    return { status: next, failure: failureSchema.parse(event.failure) };
  }
  return { status: next, failure: null };
}
