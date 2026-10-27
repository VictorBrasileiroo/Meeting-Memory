import type { Chunk, TranscriptChunk } from '../storage/recordings';

// All new chunks must carry proof of an observed stop and contiguous durable
// fragments. Old sessions retain their existing completeness policy.
export function captureIntegrity(chunks: readonly Chunk[], transcripts: readonly TranscriptChunk[], expectedCount: number): boolean {
  if (!expectedCount || chunks.length !== expectedCount) return false;
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  return ordered.every((chunk, index) => {
    const b = chunk.boundary; const previous = ordered[index - 1];
    const size = chunk.blob.size || transcripts.find(item => item.chunkId === chunk.id)?.sourceSize;
    return chunk.index === index + 1 && !chunk.error && !b.interrupted && b.finalized === true
      && Number.isInteger(b.fragmentCount) && b.fragmentCount! > 0 && b.sizeBytes > 0 && size === b.sizeBytes
      && Number.isFinite(b.observedStartMs) && Number.isFinite(b.observedStopMs)
      && b.observedStartMs >= 0 && b.observedStopMs >= b.observedStartMs
      && b.observedStopMs - b.observedStartMs < 1_800_000
      && chunk.approximateStartMs === b.observedStartMs && chunk.approximateEndMs === b.observedStopMs
      && (previous ? b.observedStartMs <= previous.boundary.observedStopMs
        && chunk.overlapMs === previous.boundary.observedStopMs - b.observedStartMs
        : b.observedStartMs === 0 && chunk.overlapMs === 0);
  });
}
