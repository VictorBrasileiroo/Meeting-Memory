import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyGeminiError, parseTranscription } from '../src/gemini/transcription';
import { claimJob, commitChunk, completeExistingTranscript, failJob, getChunk, getTranscript, listJobs, markRemoteDeleted, persistTranscript, releaseAudio, retryFailedTranscriptions, retryOneHttp404, saveRemoteFile, scheduleCleanupForFailedTranscriptions, waitForCredentials, resumeCredentialJobs, type Chunk, type TranscriptChunk, DB_NAME } from '../src/storage/recordings';

function chunk(): Chunk { return { id: 'chunk-1', recordingId: 'recording-1', index: 1, recorderId: 'recorder-1', approximateStartMs: 0, approximateEndMs: 1000, measuredDurationMs: null, overlapMs: 0, mimeType: 'audio/webm;codecs=opus', blob: new Blob(['webm'], { type: 'audio/webm;codecs=opus' }), status: 'PENDING', attempts: 0, error: null, boundary: { configMode: 'test', requestedStartMs: 0, requestedEndMs: 1000, observedStartMs: 0, observedStopMs: 1000, interrupted: false, durationSource: 'clock', requestedBitrate: 128000, observedBitrate: 128000, sizeBytes: 4 } }; }
function transcript(): TranscriptChunk { return { id: 'chunk-1', recordingId: 'recording-1', chunkId: 'chunk-1', chunkIndex: 1, model: 'gemini-3.5-transcribe', language: 'pt-BR', rawText: 'Bom dia.', annotations: [], speakers: ['spk_1'], createdAt: Date.now(), sourceMimeType: 'audio/webm;codecs=opus', sourceSize: 4, remoteFileName: 'files/example', remoteDeleteStatus: 'PENDING', attempt: 1, metadata: { durationSource: 'clock', overlapMs: 0, interactionId: 'interaction-1' } }; }
beforeEach(async () => { await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); });

describe('transcrição durável', () => {
  it('salva upload e transcript com cleanup independente; delete libera áudio depois do commit', async () => {
    await commitChunk(chunk());
    const claimed = (await claimJob('owner'))!;
    expect(claimed.kind).toBe('TRANSCRIBE_CHUNK');
    expect(await saveRemoteFile(claimed.id, 'owner', claimed.generation, { name: 'files/example', uri: 'https://file', mimeType: 'audio/webm' })).toBe(true);
    expect(await persistTranscript(claimed.id, 'other', claimed.generation, transcript())).toBe(false);
    expect(await getTranscript('chunk-1')).toBeUndefined();
    expect(await persistTranscript(claimed.id, 'owner', claimed.generation, transcript())).toBe(true);
    expect((await listJobs('recording-1')).map((job) => job.kind).sort()).toEqual(['DELETE_REMOTE_FILE', 'TRANSCRIBE_CHUNK']);
    expect(await releaseAudio('chunk-1')).toBe(false);
    const cleanup = (await claimJob('owner'))!;
    expect(cleanup.kind).toBe('DELETE_REMOTE_FILE');
    expect(await markRemoteDeleted('chunk-1', cleanup.id, 'owner', cleanup.generation)).toBe(true);
    expect(await releaseAudio('chunk-1')).toBe(true);
    expect((await getChunk('chunk-1'))?.blob.size).toBe(0);
    expect((await getTranscript('chunk-1'))?.rawText).toBe('Bom dia.');
  });
  it('não consome tentativas sem chave e retoma depois da configuração', async () => {
    await commitChunk(chunk()); const claimed = (await claimJob('owner'))!;
    expect(await waitForCredentials(claimed.id, 'owner', claimed.generation)).toBe(true);
    expect(await claimJob('other')).toBeNull();
    await resumeCredentialJobs();
    const resumed = (await claimJob('other'))!;
    expect(resumed.attempts).toBe(1);
    expect(resumed.generation).toBe(2);
  });
  it('reconcilia transcript existente sem criar segunda transcrição', async () => {
    await commitChunk(chunk()); const claimed = (await claimJob('owner'))!;
    await persistTranscript(claimed.id, 'owner', claimed.generation, transcript());
    expect(await getTranscript('chunk-1')).toMatchObject({ rawText: 'Bom dia.' });
    expect((await listJobs('recording-1')).find((job) => job.kind === 'TRANSCRIBE_CHUNK')?.status).toBe('COMPLETE');
    expect(await completeExistingTranscript(claimed.id, 'owner', claimed.generation)).toBe(false);
  });
  it('retoma falha de rede preservando o arquivo remoto já enviado', async () => {
    await commitChunk(chunk()); const claimed = (await claimJob('owner'))!;
    await saveRemoteFile(claimed.id, 'owner', claimed.generation, { name: 'files/example', uri: 'https://file', mimeType: 'audio/webm' });
    await failJob(claimed.id, 'owner', claimed.generation, { kind: 'RETRYABLE', message: 'Rede indisponível' });
    expect(await claimJob('other')).toBeNull();
    expect(await retryFailedTranscriptions('recording-1')).toBe(1);
    const resumed = (await claimJob('other'))!;
    expect(resumed.remoteFile?.name).toBe('files/example');
    expect(resumed.attempts).toBe(1);
  });
  it('404 após upload agenda limpeza e permite repetir uma parte usando o áudio local', async () => {
    await commitChunk(chunk()); const claimed = (await claimJob('owner'))!;
    await saveRemoteFile(claimed.id, 'owner', claimed.generation, { name: 'files/example', uri: 'https://file', mimeType: 'audio/webm' });
    await failJob(claimed.id, 'owner', claimed.generation, { kind: 'USER_ACTION_REQUIRED', message: 'HTTP 404 durante transcrição.' });
    expect(await scheduleCleanupForFailedTranscriptions('recording-1')).toBe(1);
    expect(await scheduleCleanupForFailedTranscriptions('recording-1')).toBe(0);
    const cleanup = (await listJobs('recording-1')).find((job) => job.id === 'delete-failed:chunk-1');
    expect(cleanup?.remoteFile?.name).toBe('files/example');
    expect((await getChunk('chunk-1'))?.blob.size).toBeGreaterThan(0);
    expect(await retryOneHttp404('recording-1', 'chunk-1')).toBe(true);
    const retried = (await listJobs('recording-1')).find((job) => job.id === claimed.id);
    expect(retried).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(retried?.remoteFile).toBeUndefined();
  });
});

describe('resposta e erros Gemini', () => {
  it('preserva output_text e annotations sem exigir offsets ou speaker', () => {
    const parsed = parseTranscription({ id: 'i1', output_text: 'Olá, tudo bem?', steps: [{ content: [{ annotations: [{ type: 'word_info', text: 'Olá', speaker: 'spk_1' }, { type: 'word_info', text: 'tudo' }, { type: 'word_info', text: 'bem', speaker: 'spk_2' }] }] }] });
    expect(parsed).toMatchObject({ rawText: 'Olá, tudo bem?', speakers: ['spk_1', 'spk_2'], interactionId: 'i1' });
    expect(parsed.annotations).toHaveLength(3);
    expect(parseTranscription({ output_text: '', steps: [] }).rawText).toBe('');
    expect(() => parseTranscription({ steps: [] })).toThrow('output_text');
  });
  it('classifica status e retry-after quando disponível sem expor resposta', () => {
    expect(classifyGeminiError({ status: 401 }).kind).toBe('USER_ACTION_REQUIRED');
    expect(classifyGeminiError({ status: 400 }).kind).toBe('PERMANENT');
    expect(classifyGeminiError({ status: 429, headers: new Headers({ 'Retry-After': '12' }) }).retryAfterMs).toBe(12_000);
    expect(classifyGeminiError({ status: 500 }).kind).toBe('RETRYABLE');
    expect(classifyGeminiError({ status: 404, error: { error: { code: 'model_not_found' } } }, 'transcription')).toMatchObject({ kind: 'USER_ACTION_REQUIRED', message: 'HTTP 404 durante transcrição (model_not_found). Modelo indisponível para esta chave.' });
    expect(classifyGeminiError({ status: 404 }, 'upload').message).toBe('Files API retornou HTTP 404 durante o upload. Confira o acesso à API Gemini.');
    expect(classifyGeminiError({ name: 'AbortError' }).kind).toBe('RETRYABLE');
    vi.useRealTimers();
  });
});
