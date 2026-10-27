import { CHUNK_CONFIG_MODE, CHUNK_TARGET_DURATION_MS, FRAGMENT_TIMESLICE_MS, FUTURE_MAX_DURATION_MS, OVERLAP_TARGET_MS } from './chunk-config';
import { REQUESTED_AUDIO_BITS_PER_SECOND, recorderOptions } from './browser-media';
import { addFragment, commitChunk, listFragments, removeFragments, type Chunk } from '../storage/recordings';

type Active = { recorder: MediaRecorder; id: string; index: number; started: number; requestedStart: number; sequence: number; writes: Promise<void>; finalizing: Promise<void> | null; stopRequested: boolean; resolveStop: (at: number) => void; rejectStop: (reason: unknown) => void };
export type RotationConfig = { targetMs: number; overlapMs: number; timesliceMs: number };
export const defaultRotationConfig: RotationConfig = { targetMs: CHUNK_TARGET_DURATION_MS, overlapMs: OVERLAP_TARGET_MS, timesliceMs: FRAGMENT_TIMESLICE_MS };
export type RotationResult = { chunkCount: number; mimeType: string; audioBitsPerSecond: number };

async function mediaDuration(blob: Blob): Promise<number | null> {
  if (typeof document === 'undefined') return null;
  const audio = document.createElement('audio'); const url = URL.createObjectURL(blob);
  try { return await new Promise<number | null>((resolve) => { const timer = setTimeout(() => resolve(null), 3000); const finish = () => { clearTimeout(timer); resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : null); }; audio.onloadedmetadata = finish; audio.onerror = finish; audio.src = url; audio.load(); }); }
  finally { audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); }
}

export class RotatingRecorder {
  private active = new Map<string, Active>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sessionStart = 0;
  private nextIndex = 1;
  private stopping = false;
  private operations: Promise<void> = Promise.resolve();
  private completed: Promise<void>[] = [];
  private failure: Error | null = null;
  private lastMime = '';
  private lastBitrate = 0;
  private observedStops = new Map<number, Promise<number>>();
  private stopPromise: Promise<RotationResult> | null = null;
  constructor(private readonly recordingId: string, private readonly stream: MediaStream, private readonly factory: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder = (stream, options) => new MediaRecorder(stream, options), private readonly config: RotationConfig = defaultRotationConfig, private readonly onFatal: (message: string) => void = () => undefined) {
    if (config.targetMs <= config.overlapMs || config.overlapMs < 0) throw new Error('Configuração de rotação inválida.');
  }
  start(): void { this.sessionStart = Date.now(); this.startRecorder(this.sessionStart); this.schedule(); }
  private startRecorder(requestedStart: number): Active {
    const recorder = this.factory(this.stream, recorderOptions()); const id = crypto.randomUUID();
    const index = this.nextIndex++;
    let resolveStop!: (at: number) => void;
    let rejectStop!: (reason: unknown) => void;
    const observedStop = new Promise<number>((resolve, reject) => { resolveStop = resolve; rejectStop = reject; });
    void observedStop.catch(() => undefined);
    this.observedStops.set(index, observedStop);
    const active: Active = { recorder, id, index, started: index === 1 ? this.sessionStart : Date.now(), requestedStart, sequence: 0, writes: Promise.resolve(), finalizing: null, stopRequested: false, resolveStop, rejectStop };
    recorder.ondataavailable = (event) => { if (!event.data.size) return; const fragment = { id: `${id}:${active.sequence}`, recordingId: this.recordingId, recorderId: id, sequence: active.sequence++, blob: event.data }; active.writes = active.writes.then(() => addFragment(fragment)); active.writes.catch((error: unknown) => { this.failure = error instanceof Error ? error : new Error('Falha ao persistir fragmento.'); this.onFatal('Falha no armazenamento local; a captura será finalizada.'); }); };
    recorder.onerror = () => { this.failure = new Error('O gravador de áudio falhou.'); this.onFatal('O gravador de áudio falhou.'); };
    recorder.addEventListener('stop', () => {
      if (!active.stopRequested) { this.failure = new Error('O gravador encerrou sem finalização solicitada.'); this.onFatal('O gravador foi encerrado inesperadamente.'); }
    });
    recorder.start(this.config.timesliceMs);
    this.active.set(id, active);
    return active;
  }
  private schedule(): void {
    if (this.stopping) return;
    const latest = [...this.active.values()].at(-1)!;
    const boundary = latest.started + this.config.targetMs;
    this.timer = setTimeout(() => { this.operations = this.operations.then(async () => {
      if (this.stopping || this.failure) return;
      const previous = [...this.active.values()].at(-1)!;
      const next = this.startRecorder(boundary - this.config.overlapMs);
      const delay = Math.max(0, boundary - Date.now());
      this.timer = setTimeout(() => { this.operations = this.operations.then(async () => { if (!this.stopping) { const finalization = this.finishRecorder(previous, boundary, false); this.completed.push(finalization); void finalization.catch(() => undefined); } this.schedule(); }).catch((error: unknown) => { this.failure = error instanceof Error ? error : new Error('Falha na rotação.'); this.onFatal('Falha na rotação do áudio.'); }); }, delay);
      // The next recorder is already receiving the same mixer stream.
      void next;
    }).catch((error: unknown) => { this.failure = error instanceof Error ? error : new Error('Falha na rotação.'); this.onFatal('Falha na rotação do áudio.'); }); }, Math.max(0, boundary - this.config.overlapMs - Date.now()));
  }
  stop(interrupted = false): Promise<RotationResult> {
    return this.stopPromise ??= this.finish(interrupted);
  }
  private async finish(interrupted: boolean): Promise<RotationResult> {
    this.stopping = true; if (this.timer) clearTimeout(this.timer);
    await this.operations;
    const remaining = [...this.active.values()].map((active) => this.finishRecorder(active, active.started + this.config.targetMs, interrupted));
    try {
      const settled = await Promise.allSettled([...this.completed, ...remaining]);
      if (settled.some(result => result.status === 'rejected')) throw this.failure ?? new Error('Uma parte não foi finalizada.');
      if (this.failure) throw this.failure;
      return { chunkCount: this.nextIndex - 1, mimeType: this.lastMime, audioBitsPerSecond: this.lastBitrate };
    } finally { this.observedStops.clear(); }
  }
  private finishRecorder(active: Active, requestedEnd: number, interrupted: boolean): Promise<void> {
    if (active.finalizing) return active.finalizing;
    active.finalizing = (async () => {
      const recorder = active.recorder;
      active.stopRequested = true;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('O gravador não confirmou a finalização.')), 15_000);
        const stopped = () => { clearTimeout(timer); resolve(); };
        recorder.addEventListener('stop', stopped, { once: true });
        recorder.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Falha ao finalizar recorder.')); }, { once: true });
        if (recorder.state === 'inactive') { clearTimeout(timer); reject(new Error('Gravador inativo sem finalização confirmada.')); }
        else { try { recorder.stop(); } catch (error) { clearTimeout(timer); reject(error); } }
      });
      const observedStop = Date.now();
      active.resolveStop(observedStop);
      const previousStop = active.index === 1 ? null : await this.observedStops.get(active.index - 1);
      const overlapMs = previousStop === null || previousStop === undefined ? 0 : Math.max(0, previousStop - active.started);
      if (active.index > 1 && previousStop === undefined) throw new Error('Fronteira anterior indisponível.');
      this.observedStops.delete(active.index - 1);
      await active.writes;
      const fragments = await listFragments(active.id);
      if (fragments.length !== active.sequence || fragments.some((fragment, index) => fragment.sequence !== index || fragment.recorderId !== active.id || fragment.recordingId !== this.recordingId || !fragment.blob.size)) throw new Error('Sequência de fragmentos incompleta.');
      const mimeType = recorder.mimeType || recorderOptions().mimeType!;
      // Assembly temporarily holds references to one chunk. The browser may copy its bytes.
      const blob = new Blob(fragments.map((fragment) => fragment.blob), { type: mimeType });
      const estimate = typeof navigator === 'undefined' ? undefined : await navigator.storage?.estimate?.().catch(() => undefined);
      if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < blob.size) throw new Error('Espaço local insuficiente para salvar a próxima parte.');
      const measuredDurationMs = await mediaDuration(blob);
      const clockDuration = observedStop - active.started;
      const duration = measuredDurationMs ?? clockDuration;
      const overshoot = duration > FUTURE_MAX_DURATION_MS;
      const empty = blob.size === 0;
      const chunk: Chunk = { id: crypto.randomUUID(), recordingId: this.recordingId, index: active.index, recorderId: active.id,
        approximateStartMs: active.started - this.sessionStart, approximateEndMs: observedStop - this.sessionStart,
        measuredDurationMs, overlapMs, mimeType, blob,
        status: overshoot || empty ? 'ERROR' : 'PENDING', attempts: 0, error: empty ? 'Arquivo WebM vazio.' : overshoot ? 'Duração ultrapassou 30 minutos; processamento futuro incompatível.' : null,
        boundary: { configMode: CHUNK_CONFIG_MODE, requestedStartMs: active.requestedStart - this.sessionStart, requestedEndMs: requestedEnd - this.sessionStart, observedStartMs: active.started - this.sessionStart, observedStopMs: observedStop - this.sessionStart, interrupted, durationSource: measuredDurationMs === null ? 'clock' : 'media', requestedBitrate: REQUESTED_AUDIO_BITS_PER_SECOND, observedBitrate: recorder.audioBitsPerSecond, sizeBytes: blob.size, finalized: !empty && !overshoot, fragmentCount: fragments.length } };
      await commitChunk(chunk); // Chunk and local job commit together; fragments remain if commit fails.
      if (empty || overshoot) { this.failure = new Error('Parte vazia ou fora do limite seguro.'); this.onFatal('O gravador gerou uma parte inválida; a captura será finalizada.'); }
      await removeFragments(active.id);
      this.lastMime = mimeType; this.lastBitrate = recorder.audioBitsPerSecond;
      this.active.delete(active.id);
    })().catch((error: unknown) => { active.rejectStop(error); this.failure = error instanceof Error ? error : new Error('Falha ao persistir chunk.'); this.onFatal('Falha ao salvar parte do áudio; a captura será finalizada.'); throw this.failure; });
    return active.finalizing;
  }
}
