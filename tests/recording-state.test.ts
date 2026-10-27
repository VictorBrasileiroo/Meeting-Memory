import { describe, expect, it } from 'vitest';
import { transition, InvalidTransitionError, type Machine, type RecordingEvent } from '../src/domain/recording-state';

describe('recording state machine', () => {
  it('percorre fluxo nominal sem APIs externas', () => {
    let machine: Machine = { status: 'IDLE', failure: null };
    const events: RecordingEvent['type'][] = ['START_REQUESTED', 'CAPTURE_READY', 'STOP_REQUESTED', 'CAPTURE_COMMITTED', 'COMPLETE'];
    const states = ['STARTING', 'RECORDING', 'STOPPING', 'PROCESSING', 'COMPLETED'];
    events.forEach((type, index) => {
      if (type === 'FAILURE') throw new Error('Evento não usado neste fluxo.');
      machine = transition(machine, { type });
      expect(machine.status).toBe(states[index]);
      expect(machine.failure).toBeNull();
    });
  });
  it.each([
    ['STARTING', 'START_REQUESTED'], ['RECORDING', 'START_REQUESTED'], ['STOPPING', 'START_REQUESTED'],
    ['STOPPING', 'STOP_REQUESTED'], ['IDLE', 'STOP_REQUESTED'], ['PROCESSING', 'START_REQUESTED'],
    ['COMPLETED', 'COMPLETE'], ['ERROR', 'CAPTURE_READY'],
  ] as const)('bloqueia %s + %s sem alterar entrada', (status, type) => {
    const machine: Machine = { status, failure: null };
    expect(() => transition(machine, { type })).toThrow(InvalidTransitionError);
    expect(machine.status).toBe(status);
  });
  it('preserva falha e recupera processamento somente com material disponível', () => {
    const failure = { phase: 'processing' as const, message: 'Falha de exemplo', recoverable: true, hasRecoverableData: true };
    const machine = transition({ status: 'PROCESSING', failure: null }, { type: 'FAILURE', failure });
    expect(machine).toEqual({ status: 'ERROR', failure });
    expect(transition(machine, { type: 'RECOVER_PROCESSING' })).toEqual({ status: 'PROCESSING', failure: null });
  });
  it.each([
    { phase: 'capture' as const, recoverable: true, hasRecoverableData: true },
    { phase: 'processing' as const, recoverable: false, hasRecoverableData: true },
    { phase: 'processing' as const, recoverable: true, hasRecoverableData: false },
  ])('rejeita recovery sem condições necessárias: %j', (conditions) => {
    expect(() => transition({ status: 'ERROR', failure: { ...conditions, message: 'Falha' } }, { type: 'RECOVER_PROCESSING' })).toThrow(InvalidTransitionError);
  });
  it('não aceita falha de processamento durante captura', () => {
    expect(() => transition({ status: 'RECORDING', failure: null }, { type: 'FAILURE', failure: { phase: 'processing', message: 'Falha', recoverable: true, hasRecoverableData: true } })).toThrow(InvalidTransitionError);
  });
});
