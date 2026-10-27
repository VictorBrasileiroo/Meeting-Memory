import type { Chunk, TranscriptChunk } from '../../src/storage/recordings';
export function makeChunk(index = 1): Chunk {
  return { id: `chunk-${index}`, recordingId: 'recording', index, recorderId: `recorder-${index}`, approximateStartMs: 0, approximateEndMs: 1000, measuredDurationMs: null, overlapMs: 0, mimeType: 'audio/webm;codecs=opus', blob: new Blob(['webm']), status: 'PENDING', attempts: 0, error: null,
    boundary: { configMode: 'test', requestedStartMs: 0, requestedEndMs: 1000, observedStartMs: 0, observedStopMs: 1000, interrupted: false, durationSource: 'clock', requestedBitrate: 128000, observedBitrate: 128000, sizeBytes: 4 } };
}
export function makeTranscript(index = 1): TranscriptChunk {
  return { id: `chunk-${index}`, recordingId: 'recording', chunkId: `chunk-${index}`, chunkIndex: index, model: 'gemini-3.5-transcribe', language: 'pt-BR', rawText: 'Texto original.', annotations: [], speakers: [], createdAt: Date.now(), sourceMimeType: 'audio/webm', sourceSize: 4, remoteFileName: `files/${index}`, remoteDeleteStatus: 'PENDING', attempt: 1, metadata: { durationSource: 'clock', overlapMs: 0, interactionId: null } };
}
