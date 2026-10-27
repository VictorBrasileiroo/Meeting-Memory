import { MICROPHONE_CONSTRAINTS, MICROPHONE_MIX_GAIN, TAB_MIX_GAIN, tabAudioConstraints } from './browser-media';
import { RotatingRecorder } from './rotating-recorder';
import { finalizeCapture } from '../storage/recordings';

export type CaptureStatus = { recordingId: string | null; state: 'IDLE' | 'STARTING' | 'RECORDING' | 'STOPPING'; startedAt: number | null };
export type CaptureLevels = { recordingId: string; tab: number; microphone: number };
type StopResult = { interrupted: boolean; mimeType: string; audioBitsPerSecond: number; chunkCount: number };
type Deps = {
  getTab: (id: string) => Promise<MediaStream>;
  getMic: () => Promise<MediaStream>;
  context: () => AudioContext;
  recorder: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  createRotation?: (recordingId: string, stream: MediaStream, factory: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder) => RotatingRecorder;
  finalizeRecording?: (recordingId: string, chunkCount: number, interrupted: boolean) => Promise<void>;
  isCapturedTabClosed?: (recordingId: string) => Promise<boolean>;
  notify: (event: 'CAPTURE_INTERRUPTED' | 'CAPTURE_FAILED' | 'CAPTURE_AUTO_STOPPED', recordingId: string, message: string) => void;
};
const browserDeps: Deps = {
  getTab: (id) => navigator.mediaDevices.getUserMedia(tabAudioConstraints(id)),
  getMic: () => navigator.mediaDevices.getUserMedia(MICROPHONE_CONSTRAINTS),
  context: () => new AudioContext(), recorder: (stream, options) => new MediaRecorder(stream, options),
  isCapturedTabClosed: async recordingId => {
    const response = await chrome.runtime.sendMessage({ target: 'background-capture-source', recordingId }) as { closed?: boolean };
    return response?.closed === true;
  },
  notify: (event, recordingId, message) => { void chrome.runtime.sendMessage({ target: 'background-capture', event, recordingId, message }).catch(() => undefined); },
};

export class CaptureSession {
  private id: string | null = null;
  private state: CaptureStatus['state'] = 'IDLE';
  private startedAt: number | null = null;
  private tab: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private tabAnalyser: AnalyserNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private rotation: RotatingRecorder | null = null;
  private stopPromise: Promise<StopResult> | null = null;
  private deliberateStop = false;
  private failureReason: string | null = null;
  private tabClosed = false;
  private tabEndCheck: Promise<boolean> | null = null;
  private cleaningUp = false;
  constructor(private readonly deps: Deps = browserDeps) {}
  status(): CaptureStatus { return { recordingId: this.id, state: this.state, startedAt: this.startedAt }; }
  levels(recordingId: string): CaptureLevels | null {
    if (this.id !== recordingId || this.state !== 'RECORDING' || !this.tabAnalyser || !this.micAnalyser) return null;
    return { recordingId, tab: this.readLevel(this.tabAnalyser), microphone: this.readLevel(this.micAnalyser) };
  }
  private readLevel(analyser: AnalyserNode): number {
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let power = 0;
    for (const sample of samples) power += ((sample - 128) / 128) ** 2;
    const rms = Math.sqrt(power / samples.length);
    return Math.min(1, Math.max(0, (rms - 0.008) * 12));
  }
  async start(recordingId: string, streamId: string): Promise<CaptureStatus> {
    if (this.state !== 'IDLE') throw new Error('Já existe uma captura no offscreen.');
    this.id = recordingId; this.state = 'STARTING'; this.deliberateStop = false;
    this.stopPromise = null; this.failureReason = null; this.tabClosed = false; this.tabEndCheck = null; this.cleaningUp = false;
    try {
      this.tab = await this.deps.getTab(streamId);
      this.assertAudio(this.tab, 'aba');
      this.mic = await this.deps.getMic();
      this.assertAudio(this.mic, 'microfone');
      this.assertAudio(this.tab, 'aba');
      const context = this.deps.context(); this.context = context;
      context.addEventListener('statechange', () => {
        if (context.state === 'closed') this.interrupt('O dispositivo de áudio foi encerrado.');
        if (context.state === 'suspended' && this.state === 'RECORDING') {
          void context.resume().catch(() => this.interrupt('O áudio foi suspenso pelo navegador.'));
        }
      });
      const tabSource = context.createMediaStreamSource(this.tab);
      const micSource = context.createMediaStreamSource(this.mic);
      const tabGain = context.createGain(); tabGain.gain.value = TAB_MIX_GAIN;
      const micGain = context.createGain(); micGain.gain.value = MICROPHONE_MIX_GAIN;
      this.tabAnalyser = context.createAnalyser(); this.tabAnalyser.fftSize = 512;
      this.micAnalyser = context.createAnalyser(); this.micAnalyser.fftSize = 512;
      const mixer = context.createMediaStreamDestination();
      tabSource.connect(context.destination); // tab playback only; never connect mic to destination.
      tabSource.connect(this.tabAnalyser); this.tabAnalyser.connect(tabGain); tabGain.connect(mixer);
      micSource.connect(this.micAnalyser); this.micAnalyser.connect(micGain); micGain.connect(mixer);
      this.nodes = [tabSource, micSource, tabGain, micGain, this.tabAnalyser, this.micAnalyser, mixer];
      if (context.state !== 'running') await context.resume();
      if (context.state !== 'running') throw new Error('O áudio da aba não pôde ser reproduzido.');
      this.rotation = this.deps.createRotation?.(recordingId, mixer.stream, this.deps.recorder) ?? new RotatingRecorder(recordingId, mixer.stream, this.deps.recorder, undefined, (message) => this.interrupt(message));
      for (const track of this.tab.getAudioTracks()) track.addEventListener('ended', () => this.tabSourceEnded());
      for (const track of this.mic.getAudioTracks()) track.addEventListener('ended', () => this.interrupt('O microfone foi encerrado.'));
      // mute/unmute are intentionally not terminal events.
      this.startedAt = Date.now();
      this.rotation.start();
      this.state = 'RECORDING';
      return this.status();
    } catch (error) {
      await this.cleanup(); this.state = 'IDLE'; this.id = null;
      throw error;
    }
  }
  private assertAudio(stream: MediaStream, source: string): void {
    if (!stream.getAudioTracks().some((track) => track.readyState === 'live')) throw new Error(`O áudio da ${source} não está disponível.`);
  }
  interrupt(message: string): void {
    if (this.cleaningUp || !['RECORDING', 'STOPPING'].includes(this.state) || !this.id) return;
    this.failureReason ??= message; // Faults dominate even if a normal stop is pending.
    if (this.state === 'RECORDING') void this.stop(true).catch(() => undefined);
  }
  private tabSourceEnded(): void {
    if (this.deliberateStop || this.state !== 'RECORDING' || !this.id) return;
    this.tabEndCheck = (this.deps.isCapturedTabClosed?.(this.id) ?? Promise.resolve(false)).catch(() => false);
    // Stop the mixer immediately; classify closure before committing completeness.
    void this.stop().catch(() => undefined);
  }
  closeTab(): Promise<StopResult> {
    if (this.state === 'RECORDING' || this.state === 'STOPPING') this.tabClosed = true;
    return this.stop();
  }
  stop(interrupted = false): Promise<StopResult> {
    if (this.stopPromise) return this.stopPromise;
    if (!this.rotation || !this.id || this.state !== 'RECORDING') return Promise.reject(new Error('Não há captura ativa.'));
    this.state = 'STOPPING'; this.deliberateStop = true;
    this.stopPromise = this.finish(interrupted);
    return this.stopPromise;
  }
  private async finish(interrupted: boolean): Promise<StopResult> {
    const rotation = this.rotation!; const recordingId = this.id!;
    try {
      const result = await rotation.stop(interrupted);
      if (this.tabEndCheck) {
        const closed = await this.tabEndCheck;
        if (closed) this.tabClosed = true;
        else if (!this.tabClosed) this.failureReason ??= 'A fonte da aba foi encerrada sem fechamento confirmado.';
      }
      interrupted ||= this.failureReason !== null;
      if (this.deps.finalizeRecording) await this.deps.finalizeRecording(recordingId, result.chunkCount, interrupted);
      else interrupted = !await finalizeCapture(recordingId, result.chunkCount, interrupted, interrupted ? 'SOURCE_LOST' : this.tabClosed ? 'TAB_CLOSED' : 'MANUAL', this.startedAt ?? undefined);
      if (interrupted) this.deps.notify('CAPTURE_INTERRUPTED', recordingId, this.failureReason ?? 'A integridade do áudio não foi comprovada.');
      else if (this.tabClosed) this.deps.notify('CAPTURE_AUTO_STOPPED', recordingId, 'Gravação encerrada automaticamente porque a aba foi fechada.');
      return { interrupted, ...result };
    } catch (error) {
      if (!this.deps.finalizeRecording) await finalizeCapture(recordingId, 0, true, 'SOURCE_LOST', this.startedAt ?? undefined).catch(() => undefined);
      this.deps.notify('CAPTURE_FAILED', recordingId, 'Não foi possível finalizar e confirmar a integridade do áudio. Os dados salvos foram preservados.');
      throw error;
    } finally {
      await this.cleanup(); this.state = 'IDLE'; this.id = null; this.startedAt = null;
    }
  }
  private async cleanup(): Promise<void> {
    this.cleaningUp = true;
    for (const stream of [this.tab, this.mic]) stream?.getTracks().forEach((track) => track.stop());
    this.tab = null; this.mic = null;
    for (const node of this.nodes) node.disconnect(); this.nodes = [];
    this.tabAnalyser = null; this.micAnalyser = null;
    if (this.context) await this.context.close().catch(() => undefined);
    this.context = null; this.rotation = null;
  }
}
