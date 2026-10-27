import { afterEach, expect, it, vi } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { classifyGeminiError, GoogleGeminiTranscriptionClient } from '../src/gemini/transcription';
import { twoSpeakerResponse } from './fixtures/transcription-response';

afterEach(() => vi.unstubAllGlobals());
it('inicia upload de Blob com protocolo resumable e cabeçalhos exigidos pela Files API', async () => {
  let uploadRequest: Request | null = null;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    uploadRequest = input instanceof Request ? input : new Request(input, init);
    return new Response(JSON.stringify({ error: { code: 404, message: 'test' } }), {
      status: 404, headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new GoogleGeminiTranscriptionClient('test-only-key');
  await expect(client.uploadAudio(new Blob(['test'], { type: 'audio/webm' }), 'audio/webm;codecs=opus', new AbortController().signal)).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(uploadRequest).not.toBeNull();
  const request = uploadRequest as unknown as Request;
  expect(new URL(request.url).pathname).toBe('/upload/v1beta/files');
  expect(request.headers.get('x-goog-upload-protocol')).toBe('resumable');
  expect(request.headers.get('x-goog-upload-command')).toBe('start');
  expect(request.headers.get('x-goog-upload-header-content-length')).toBe('4');
  expect(request.headers.get('x-goog-upload-header-content-type')).toBe('audio/webm');
  expect(JSON.parse(await request.text())).toMatchObject({ file: { mimeType: 'audio/webm', sizeBytes: '4' } });
});
it('SDK real preserva steps, annotations e id; adapter extrai dois falantes do contrato oficial', async () => {
  let body: Record<string, unknown> | null = null;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    body = JSON.parse(await request.text()) as Record<string, unknown>;
    return new Response(JSON.stringify(twoSpeakerResponse), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  const client = new GoogleGeminiTranscriptionClient('test-only-key');
  const parsed = await client.transcribe({ name: 'files/test', uri: 'https://example.test/file', mimeType: 'audio/webm' }, new AbortController().signal);
  expect(body).toMatchObject({ store: false, generation_config: { transcription_config: { language_codes: ['pt-BR'], mode: { type: 'verbatim', diarization_mode: 'speaker' } } } });
  expect(parsed).toMatchObject({ rawText: 'Bom dia. Vamos começar? Sim.', speakers: ['spk_1', 'spk_2'], interactionId: twoSpeakerResponse.id });
  expect(parsed.annotations).toEqual(twoSpeakerResponse.steps[0]!.content[0]!.annotations);
});
it('429 real do SDK expõe Retry-After e não repete internamente a chamada', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, message: 'sensitive error', status: 'RESOURCE_EXHAUSTED' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '90' } }));
  vi.stubGlobal('fetch', fetchMock);
  const client = new GoogleGeminiTranscriptionClient('test-only-key');
  let caught: unknown;
  try { await client.transcribe({ name: 'files/test', uri: 'https://example.test/file', mimeType: 'audio/webm' }, new AbortController().signal); } catch (error) { caught = error; }
  expect(fetchMock).toHaveBeenCalledOnce();
  const failure = classifyGeminiError(caught);
  expect(failure).toMatchObject({ kind: 'RETRYABLE', rateLimited: true, retryAfterMs: 90_000 });
  expect(failure.message).not.toContain('sensitive');
});
it('SDK 2.24.0 serializa store:false no corpo HTTP sem background', async () => {
  let body: Record<string, unknown> | null = null;
  let requestUrl = '';
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requestUrl = request.url;
    body = JSON.parse(await request.text()) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: 'test-interaction', model: 'gemini-3.5-transcribe', steps: [], output_text: '' }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new GoogleGenAI({ apiKey: 'test-only-key' });
  await client.interactions.create({ model: 'gemini-3.5-transcribe', input: [{ type: 'audio', uri: 'https://example.test/file', mime_type: 'audio/webm' }], store: false,
    generation_config: { transcription_config: { language_codes: ['pt-BR'], mode: { type: 'verbatim', diarization_mode: 'speaker' } } } }, { retries: { strategy: 'none' } });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(body).toMatchObject({ store: false, model: 'gemini-3.5-transcribe', generation_config: { transcription_config: { language_codes: ['pt-BR'], mode: { type: 'verbatim', diarization_mode: 'speaker' } } } });
  expect(body).not.toHaveProperty('background');
  expect(requestUrl).not.toContain('test-only-key');
  expect(new URL(requestUrl).pathname).toBe('/v1beta/interactions');
});
