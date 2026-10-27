import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RotatingRecorder } from '../src/capture/rotating-recorder';
import { commitChunk, listFragments } from '../src/storage/recordings';

const store = vi.hoisted(() => ({ fragments: new Map<string, Array<{ id: string; recordingId: string; recorderId: string; sequence: number; blob: Blob }>>(), chunks: [] as Array<{ index: number; blob: Blob; overlapMs: number; boundary: { interrupted: boolean; observedStartMs: number; observedStopMs: number } }>, commitOrder: [] as number[], commitDelayMs: 0 }));
vi.mock('../src/storage/recordings', () => ({
  addFragment: vi.fn(async (fragment: { recorderId: string }) => { const rows = store.fragments.get(fragment.recorderId) ?? []; rows.push(fragment as never); store.fragments.set(fragment.recorderId, rows); }),
  listFragments: vi.fn(async (id: string) => store.fragments.get(id) ?? []),
  commitChunk: vi.fn(async (chunk: typeof store.chunks[number]) => { if (chunk.index === 1 && store.commitDelayMs) await new Promise((resolve) => setTimeout(resolve, store.commitDelayMs)); if (store.chunks.some((old) => old.index === chunk.index)) throw new Error('duplicate'); store.chunks.push(chunk); store.commitOrder.push(chunk.index); }),
  removeFragments: vi.fn(async (id: string) => { store.fragments.delete(id); }),
}));
class FakeRecorder extends EventTarget {
  state = 'inactive'; mimeType = 'audio/webm;codecs=opus'; audioBitsPerSecond = 128_000;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['complete-webm']) } as BlobEvent); this.dispatchEvent(new Event('stop')); }
}
class DelayedRecorder extends FakeRecorder {
  constructor(private readonly delayMs: number) { super(); }
  override stop() { setTimeout(() => super.stop(), this.delayMs); }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); store.fragments.clear(); store.chunks.length = 0; store.commitOrder.length = 0; store.commitDelayMs = 0; vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('rotação isolada com clock e recorder fake', () => {
  it('sequência ausente aborta conclusão e preserva fragmentos para revisão', async () => {
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new FakeRecorder() as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); vi.mocked(listFragments).mockResolvedValueOnce([]);
    await expect(rotation.stop()).rejects.toThrow('Sequência');
    expect(store.chunks).toHaveLength(0); expect(store.fragments.size).toBe(1);
  });
  it('falha de commit preserva o fragmento final e não declara sucesso', async () => {
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new FakeRecorder() as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); vi.mocked(commitChunk).mockRejectedValueOnce(new Error('synthetic storage failure'));
    await expect(rotation.stop()).rejects.toThrow('synthetic storage failure');
    expect(store.chunks).toHaveLength(0); expect(store.fragments.size).toBe(1);
  });
  it('stop sem confirmação expira com erro e chamadas repetidas compartilham o resultado', async () => {
    const recorder = new FakeRecorder(); recorder.stop = () => { recorder.state = 'inactive'; };
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => recorder as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); const stopped = rotation.stop(); const settled = expect(stopped).rejects.toThrow('não confirmou');
    expect(rotation.stop()).toBe(stopped); await vi.advanceTimersByTimeAsync(15_001); await settled;
    expect(store.chunks).toHaveLength(0);
  });
  it('MediaRecorder encerrado sem STOP solicitado é falha, mesmo com dados salvos', async () => {
    const recorder = new FakeRecorder(); const fatal = vi.fn();
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => recorder as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 }, fatal);
    rotation.start(); recorder.stop(); expect(fatal).toHaveBeenCalled();
    await expect(rotation.stop()).rejects.toThrow();
    expect(store.fragments.size).toBe(1);
  });
  it('produz índices únicos e última parte parcial', async () => {
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new FakeRecorder() as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); await vi.advanceTimersByTimeAsync(35_000); await rotation.stop();
    expect(store.chunks.map((chunk) => chunk.index).sort()).toEqual([1, 2, 3, 4]);
    expect(store.chunks.every((chunk) => chunk.blob.size > 0)).toBe(true);
    expect(store.fragments.size).toBe(0);
  });
  it('STOP durante overlap encerra ambos e preserva as duas partes', async () => {
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new FakeRecorder() as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); await vi.advanceTimersByTimeAsync(9500); await rotation.stop();
    expect(store.chunks.map((chunk) => chunk.index).sort()).toEqual([1, 2]);
    expect(store.chunks.every((chunk) => chunk.boundary.interrupted === false)).toBe(true);
  });
  it.each([8500, 10_500])('STOP em %i ms salva o último áudio e não duplica índice', async (elapsed) => {
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new FakeRecorder() as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); await vi.advanceTimersByTimeAsync(elapsed); await rotation.stop();
    const indices = store.chunks.map((chunk) => chunk.index).sort();
    expect(indices).toEqual(elapsed < 9000 ? [1] : [1, 2]);
    expect(store.chunks.every((chunk) => chunk.blob.size > 0)).toBe(true);
  });
  it.each([[100, 0, 600], [0, 100, 500]])('STOP no overlap com delays A=%i B=%i grava overlap observado %i ms', async (delayA, delayB, expectedOverlap) => {
    let count = 0;
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new DelayedRecorder(count++ === 0 ? delayA : delayB) as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); await vi.advanceTimersByTimeAsync(9500);
    const stopped = rotation.stop(); await vi.advanceTimersByTimeAsync(150); await stopped;
    const chunks = store.chunks.sort((a, b) => a.index - b.index);
    expect(chunks.map((chunk) => chunk.overlapMs)).toEqual([0, expectedOverlap]);
    expect(chunks[1]!.overlapMs).toBe(Math.max(0, chunks[0]!.boundary.observedStopMs - chunks[1]!.boundary.observedStartMs));
  });
  it('persistência em ordem inversa conserva overlap e STOP logo após a fronteira', async () => {
    store.commitDelayMs = 1000;
    const rotation = new RotatingRecorder('session', {} as MediaStream, () => new FakeRecorder() as unknown as MediaRecorder, { targetMs: 10_000, overlapMs: 1000, timesliceMs: 1000 });
    rotation.start(); await vi.advanceTimersByTimeAsync(10_500);
    const stopped = rotation.stop(); await vi.advanceTimersByTimeAsync(600); await stopped;
    expect(store.commitOrder).toEqual([2, 1]);
    expect(store.chunks.find((chunk) => chunk.index === 2)?.overlapMs).toBe(1000);
    expect(store.chunks.every((chunk) => chunk.overlapMs >= 0)).toBe(true);
  });
});
