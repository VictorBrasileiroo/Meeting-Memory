import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptureSession } from '../src/capture/capture-session';
import { MICROPHONE_CONSTRAINTS, tabAudioConstraints } from '../src/capture/browser-media';
import type { RotatingRecorder } from '../src/capture/rotating-recorder';

function fakeTrack() {
  const track = new EventTarget() as MediaStreamTrack;
  Object.assign(track, { readyState: 'live', stop: vi.fn() });
  return track;
}
function fakeStream(track: MediaStreamTrack) {
  return { getAudioTracks: () => [track], getTracks: () => [track] } as MediaStream;
}
function fixture(micFailure = false) {
  const tabTrack = fakeTrack(); const micTrack = fakeTrack();
  const output = {} as AudioDestinationNode;
  const connections: Array<[string, unknown]> = [];
  const node = (name: string) => ({ connect: vi.fn((target: unknown) => connections.push([name, target])), disconnect: vi.fn() });
  const tabSource = node('tab'); const micSource = node('mic');
  const tabGain = { ...node('tabGain'), gain: { value: 1 } };
  const micGain = { ...node('micGain'), gain: { value: 1 } };
  const mixer = { ...node('mixer'), stream: {} as MediaStream };
  const tabAnalyser = { ...node('tabAnalyser'), fftSize: 512, getByteTimeDomainData: vi.fn((samples: Uint8Array) => samples.fill(160)) };
  const micAnalyser = { ...node('micAnalyser'), fftSize: 512, getByteTimeDomainData: vi.fn((samples: Uint8Array) => samples.fill(128)) };
  const context = { state: 'running', destination: output, addEventListener: vi.fn(), createMediaStreamSource: vi.fn().mockReturnValueOnce(tabSource).mockReturnValueOnce(micSource),
    createGain: vi.fn().mockReturnValueOnce(tabGain).mockReturnValueOnce(micGain), createAnalyser: vi.fn().mockReturnValueOnce(tabAnalyser).mockReturnValueOnce(micAnalyser), createMediaStreamDestination: () => mixer, resume: vi.fn(), close: vi.fn(async () => undefined) };
  const recorder = new EventTarget() as MediaRecorder;
  Object.assign(recorder, { state: 'inactive', mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128_000,
    start: vi.fn(() => { Object.assign(recorder, { state: 'recording' }); }),
    stop: vi.fn(() => { Object.assign(recorder, { state: 'inactive' }); recorder.ondataavailable?.(Object.assign(new Event('dataavailable'), { data: new Blob(['audio']) }) as BlobEvent); recorder.dispatchEvent(new Event('stop')); }),
  });
  vi.stubGlobal('MediaRecorder', { isTypeSupported: (type: string) => type === 'audio/webm;codecs=opus' });
  const save = vi.fn(async () => ({ chunkCount: 1, mimeType: 'audio/webm', audioBitsPerSecond: 128_000 }));
  const notify = vi.fn();
  const capture = new CaptureSession({ getTab: vi.fn(async () => fakeStream(tabTrack)), getMic: vi.fn(async () => {
    if (micFailure) throw new Error('mic negado');
    return fakeStream(micTrack);
  }), context: () => context as unknown as AudioContext, recorder: () => recorder, createRotation: () => ({ start: vi.fn(), stop: save }) as unknown as RotatingRecorder, finalizeRecording: vi.fn(async () => undefined), notify });
  return { capture, tabTrack, micTrack, context, output, connections, tabSource, micSource, tabGain, micGain, tabAnalyser, micAnalyser, recorder, save, notify };
}
afterEach(() => vi.unstubAllGlobals());
describe('captura com adapters, sem browser real', () => {
  it('isola constraints Chromium e mantém vídeo desligado', () => {
    expect(tabAudioConstraints('token')).toMatchObject({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: 'token' } }, video: false });
    expect(MICROPHONE_CONSTRAINTS).toMatchObject({ video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  });
  it('grava ambas as fontes, reproduz só aba e aguarda dado final antes de salvar e limpar', async () => {
    const f = fixture();
    await f.capture.start('id', 'token');
    expect(f.connections).toContainEqual(['tab', f.output]);
    expect(f.connections).not.toContainEqual(['mic', f.output]);
    expect(f.connections).toContainEqual(['tab', f.tabAnalyser]);
    expect(f.connections).toContainEqual(['mic', f.micAnalyser]);
    expect(f.tabGain.gain.value).toBeLessThan(1);
    expect(f.micGain.gain.value).toBeLessThan(1);
    expect(f.capture.levels('id')).toMatchObject({ tab: expect.any(Number), microphone: 0 });
    expect(f.capture.levels('id')!.tab).toBeGreaterThan(0);
    expect(f.capture.levels('wrong-id')).toBeNull();
    expect(f.connections).not.toContainEqual(['mic', f.output]);
    await f.capture.stop();
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.tabTrack.stop).toHaveBeenCalledOnce();
    expect(f.micTrack.stop).toHaveBeenCalledOnce();
    expect(f.context.close).toHaveBeenCalledOnce();
    expect(f.capture.levels('id')).toBeNull();
  });
  it('falha de microfone libera a aba e não inicia gravação parcial', async () => {
    const f = fixture(true);
    await expect(f.capture.start('id', 'token')).rejects.toThrow('mic negado');
    expect(f.tabTrack.stop).toHaveBeenCalledOnce();
    expect(f.capture.status().state).toBe('IDLE');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('mute não encerra; ended marca interrupção e salva áudio parcial', async () => {
    const f = fixture();
    await f.capture.start('id', 'token');
    f.micTrack.dispatchEvent(new Event('mute'));
    expect(f.capture.status().state).toBe('RECORDING');
    f.micTrack.dispatchEvent(new Event('ended'));
    await vi.waitFor(() => expect(f.notify).toHaveBeenCalledWith('CAPTURE_INTERRUPTED', 'id', expect.any(String)));
    expect(f.save).toHaveBeenCalledOnce();
  });
});
