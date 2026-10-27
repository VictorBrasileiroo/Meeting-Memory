import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), create: vi.fn(), remove: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { files = { upload: mocks.upload, delete: mocks.remove }; interactions = { create: mocks.create }; } }));
import { GoogleGeminiTranscriptionClient } from '../src/gemini/transcription';

describe('adapter Gemini', () => {
  it('envia Blob WebM e usa store:false, verbatim e diarização', async () => {
    mocks.upload.mockResolvedValueOnce({ name: 'files/a', uri: 'https://file', mimeType: 'audio/webm' });
    mocks.create.mockResolvedValueOnce({ id: 'interaction-1', output_text: 'Bom dia', steps: [] });
    mocks.remove.mockResolvedValueOnce(undefined);
    const client = new GoogleGeminiTranscriptionClient('test-only-key');
    const signal = new AbortController().signal;
    const blob = new Blob(['webm'], { type: 'audio/webm;codecs=opus' });
    const file = await client.uploadAudio(blob, blob.type, signal);
    expect(mocks.upload).toHaveBeenCalledWith({ file: blob, config: { mimeType: 'audio/webm', abortSignal: signal } });
    expect((await client.transcribe(file, signal)).rawText).toBe('Bom dia');
    expect(mocks.create).toHaveBeenCalledWith({ model: 'gemini-3.5-transcribe', input: [{ type: 'audio', uri: 'https://file', mime_type: 'audio/webm' }], store: false, generation_config: { transcription_config: { language_codes: ['pt-BR'], mode: { type: 'verbatim', diarization_mode: 'speaker' } } } }, { signal, retries: { strategy: 'none' } });
    await client.deleteFile(file.name, signal);
    expect(mocks.remove).toHaveBeenCalledWith({ name: 'files/a', config: { abortSignal: signal, httpOptions: { retryOptions: { attempts: 1 } } } });
  });
});
