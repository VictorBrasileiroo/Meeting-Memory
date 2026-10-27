// Chromium tab constraints are confined to this adapter.
export function tabAudioConstraints(streamId: string): MediaStreamConstraints {
  return { audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }, video: false } as MediaStreamConstraints;
}

// Initial values only; browser/device processing and actual bitrate can differ.
export const MICROPHONE_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
};
export const REQUESTED_AUDIO_BITS_PER_SECOND = 128_000;
export const TAB_MIX_GAIN = 0.75;
export const MICROPHONE_MIX_GAIN = 0.75;

export function recorderOptions(): MediaRecorderOptions {
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('Este Edge não oferece gravação de áudio WebM suportada.');
  return { mimeType, audioBitsPerSecond: REQUESTED_AUDIO_BITS_PER_SECOND };
}
