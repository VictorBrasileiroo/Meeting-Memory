import { claimJob, completeExistingTranscript, enqueueOrphanCleanup, failJob, getChunk, getRecording, getTranscript, markRemoteDeleted, persistTranscript, releaseAudio, renewJobLease, reserveTranscription, resumeCredentialJobs, saveRemoteFile, waitForCredentials, type Job, type TranscriptChunk } from '../storage/recordings';
import { classifyGeminiError, GoogleGeminiTranscriptionClient, TRANSCRIPTION_MODEL, type GeminiStage } from '../gemini/transcription';
import { localChunkFailure } from './job-policy';
import { startLeaseHeartbeat } from './lease-heartbeat';
import { completeExistingNotes, enqueueAnalysis, getNotes, listChunks, listRecordings, listTranscripts, persistAnalysisProbeStep, persistNotes } from '../storage/recordings';
import { classifyAnalysisError, GoogleGeminiAnalysisClient } from '../gemini/analysis';
import { analysisSourceKey, AnalysisError } from '../domain/analysis-input';
import { ANALYSIS_PROBE_MODEL, analysisProbeStages } from '../domain/analysis-probe';

const owner = crypto.randomUUID();
let busy = false;
let shuttingDown = false;
let apiKey = '';
let lastJobRecordingId = '';
let testBudget = __CHUNK_TEST__ || __FOUNDATION_MOCK__ ? 0 : Number.POSITIVE_INFINITY;
let heartbeat: ReturnType<typeof startLeaseHeartbeat> | null = null;
async function processJob(job: Job): Promise<'DEFERRED' | void> {
  heartbeat = startLeaseHeartbeat(() => renewJobLease(job.id, owner, job.generation));
  let stage: GeminiStage = job.kind === 'DELETE_REMOTE_FILE' ? 'cleanup' : job.remoteFile ? 'transcription' : 'upload';
  const probeStage = job.kind === 'ANALYZE_RECORDING' && job.analysisProbe && !job.analysisProbe.done ? analysisProbeStages(job.analysisProbe)[job.analysisProbe.nextStage] : undefined;
  try {
    if (job.kind === 'ANALYZE_RECORDING') {
      if (await getNotes(job.recordingId)) { await heartbeat.stop(); if (!heartbeat.signal.aborted && !shuttingDown) await completeExistingNotes(job.id, owner, job.generation); return; }
      if (!apiKey) { await heartbeat.stop(); await waitForCredentials(job.id, owner, job.generation); return; }
      if (probeStage) {
        if (job.analysisProbe?.version !== 2 || job.analysisProbe.model !== ANALYSIS_PROBE_MODEL) {
          await persistAnalysisProbeStep(job.id, owner, job.generation, { stage: probeStage, outcome: 'FAILED', message: 'Teste antigo encerrado sem envio. Inicie o novo teste com Lite.' });
          await heartbeat.stop(); return;
        }
        const recording = await getRecording(job.recordingId);
        if (!recording?.analysisModel) throw new AnalysisError('INCOMPLETE');
        await new GoogleGeminiAnalysisClient(apiKey).probe(job.analysisProbe.model, recording.profile, probeStage, heartbeat.signal);
        if (!heartbeat.signal.aborted && !shuttingDown) await persistAnalysisProbeStep(job.id, owner, job.generation, { stage: probeStage, outcome: 'ACCEPTED' });
        await heartbeat.stop(); return;
      }
      const [recording, chunks, transcripts] = await Promise.all([getRecording(job.recordingId), listChunks(job.recordingId), listTranscripts(job.recordingId)]);
      if (!recording) throw new AnalysisError('INCOMPLETE');
      const { validation, ...output } = await new GoogleGeminiAnalysisClient(apiKey).analyze(job.analysisModelOverride ? { ...recording, analysisModel: job.analysisModelOverride } : recording, chunks, transcripts, heartbeat.signal);
      if (!heartbeat.signal.aborted && !shuttingDown) await persistNotes(job.id, owner, job.generation, output, analysisSourceKey(transcripts), validation);
      await heartbeat.stop(); return;
    }
    if (!apiKey) { await heartbeat.stop(); await waitForCredentials(job.id, owner, job.generation); return; }
    const client = new GoogleGeminiTranscriptionClient(apiKey);
    if (job.kind === 'DELETE_REMOTE_FILE') {
      if (!job.remoteFile) throw new Error('Identidade do arquivo remoto ausente.');
      try { await client.deleteFile(job.remoteFile.name, heartbeat.signal); }
      catch (error) { if ((error as { status?: number })?.status !== 404) throw error; }
      await heartbeat.stop();
      if (!heartbeat.signal.aborted && !shuttingDown) { const committed = await markRemoteDeleted(job.chunkId, job.id, owner, job.generation); const recording = await getRecording(job.recordingId); if (committed && recording?.retention !== 'keep-local') await releaseAudio(job.chunkId); }
      return;
    }
    const existing = await getTranscript(job.chunkId);
    if (existing) {
      await heartbeat.stop();
      if (!heartbeat.signal.aborted && !shuttingDown) await completeExistingTranscript(job.id, owner, job.generation);
      return;
    }
    const chunk = await getChunk(job.chunkId);
    const invalid = localChunkFailure(chunk);
    if (invalid || !chunk) { await heartbeat.stop(); if (!heartbeat.signal.aborted && !shuttingDown) await failJob(job.id, owner, job.generation, invalid ?? { kind: 'PERMANENT', message: 'Chunk ausente.' }); return; }
    let remote = job.remoteFile;
    if (!remote) {
      remote = await client.uploadAudio(chunk.blob, chunk.mimeType, heartbeat.signal);
      if (!await saveRemoteFile(job.id, owner, job.generation, remote)) { await enqueueOrphanCleanup(job.recordingId, job.chunkId, remote); await heartbeat.stop(true); return; }
    }
    stage = 'transcription';
    if (heartbeat.signal.aborted || shuttingDown) return;
    const admission = await reserveTranscription(job.id, owner, job.generation);
    if (admission !== 'ADMITTED') { await heartbeat.stop(); return admission === 'DEFERRED' ? 'DEFERRED' : undefined; }
    if (heartbeat.signal.aborted || shuttingDown) return;
    const result = await client.transcribe(remote, heartbeat.signal);
    const transcript: TranscriptChunk = { id: chunk.id, recordingId: chunk.recordingId, chunkId: chunk.id, chunkIndex: chunk.index, model: TRANSCRIPTION_MODEL,
      language: 'pt-BR', rawText: result.rawText, annotations: result.annotations, speakers: result.speakers, createdAt: Date.now(),
      sourceMimeType: chunk.mimeType, sourceSize: chunk.blob.size, remoteFileName: remote.name, remoteDeleteStatus: 'PENDING', attempt: job.attempts,
      metadata: { durationSource: chunk.boundary.durationSource, overlapMs: chunk.overlapMs, interactionId: result.interactionId } };
    if (!heartbeat.signal.aborted && !shuttingDown) await persistTranscript(job.id, owner, job.generation, transcript);
    await heartbeat.stop();
  } catch (error) {
    const failure = job.kind === 'ANALYZE_RECORDING' ? classifyAnalysisError(error) : classifyGeminiError(error, stage);
    if (probeStage) {
      if (!heartbeat.signal.aborted && !shuttingDown) await persistAnalysisProbeStep(job.id, owner, job.generation, { stage: probeStage, outcome: 'FAILED', message: failure.message, ...(failure.analysisDiagnostic ? { diagnostic: failure.analysisDiagnostic } : {}) });
      await heartbeat.stop(); return;
    }
    await heartbeat.stop();
    if (!heartbeat.signal.aborted && !shuttingDown) await failJob(job.id, owner, job.generation, failure);
  } finally { await heartbeat?.stop(); heartbeat = null; }
}
async function drain(): Promise<void> {
  if (busy || shuttingDown) return;
  busy = true;
  try {
    while (!shuttingDown) {
      for (const recording of await listRecordings()) {
        if (recording.analysisModel && recording.endedAt && recording.status !== 'COMPLETED') await enqueueAnalysis(recording.id);
        // Continue the configured retention only after derived notes are safely
        // committed. New captures keep their audio on partial capture/analysis failure.
        if (recording.retention !== 'keep-local' && recording.status === 'COMPLETED' && await getNotes(recording.id)) {
          for (const chunk of await listChunks(recording.id)) if (chunk.blob.size && chunk.boundary.finalized) await releaseAudio(chunk.id);
        }
      }
      const job = await claimJob(owner, Date.now(), undefined, testBudget > 0 ? ['TRANSCRIBE_CHUNK', 'DELETE_REMOTE_FILE', 'ANALYZE_RECORDING'] : ['DELETE_REMOTE_FILE', 'ANALYZE_RECORDING']);
      if (!job) break;
      lastJobRecordingId = job.recordingId;
      const result = await processJob(job);
      if (__CHUNK_TEST__ && job.kind === 'TRANSCRIBE_CHUNK' && result !== 'DEFERRED') testBudget--;
    }
    postMessage({ type: 'DRAINED', recordingId: lastJobRecordingId });
  } catch { postMessage({ type: 'ERROR' }); }
  finally { busy = false; }
}
self.onmessage = (event: MessageEvent<{ type: string; apiKey?: string }>) => {
  if (event.data.type === 'CREDENTIAL' && typeof event.data.apiKey === 'string') { apiKey = event.data.apiKey; if (apiKey) void resumeCredentialJobs().then(drain); else void drain(); }
  if (event.data.type === 'ENABLE_TEST_TRANSCRIPTION' && __CHUNK_TEST__) { testBudget += 1; void drain(); }
  if (event.data.type === 'WAKE') void drain();
  if (event.data.type === 'SHUTDOWN') { shuttingDown = true; clearInterval(poll); void (heartbeat?.stop(true) ?? Promise.resolve()).then(() => self.close()); }
};
const poll = setInterval(() => void drain(), 2000);
