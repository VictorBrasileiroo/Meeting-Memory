import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { analysisJobId, claimJob, commitChunk, completeExistingNotes, createRecording, DB_NAME, enqueueAnalysis, failJob, getNotes, getRecording, getTranscript, listJobs, listTranscripts, openDatabase, persistAnalysisProbeStep, persistNotes, persistTranscript, retryAnalysis, updateRecording, waitForCredentials, resumeCredentialJobs } from '../src/storage/recordings';
import { analysisSourceKey, AnalysisError } from '../src/domain/analysis-input';
import { classifyAnalysisError } from '../src/gemini/analysis';
import { makeChunk, makeTranscript } from './fixtures/recording';
import { analysisRecording, notesOutput, sourceText } from './fixtures/notes';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(1_000_000);
  await new Promise<void>((resolve) => { const req = indexedDB.deleteDatabase(DB_NAME); req.onsuccess = () => resolve(); });
});
afterEach(() => vi.useRealTimers());
async function ready(count = 1) {
  const recording = analysisRecording(count); await createRecording(recording);
  for (let index = 1; index <= count; index++) {
    await commitChunk(makeChunk(index));
    const job = (await claimJob('transcriber', Date.now(), undefined, ['TRANSCRIBE_CHUNK']))!;
    await persistTranscript(job.id, 'transcriber', job.generation, { ...makeTranscript(index), rawText: sourceText });
  }
  return recording;
}
it('probe persiste avanço e intervalo; lease antigo e cliques concorrentes não duplicam etapa', async () => {
  await ready(); await enqueueAnalysis('recording'); const first = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(first.id, 'A', first.generation, { kind: 'PERMANENT', message: 'HTTP 400' });
  expect(await Promise.all([retryAnalysis('recording', 'probe'), retryAnalysis('recording', 'probe')])).toEqual([1, 0]);
  const stale = (await claimJob('stale', Date.now(), 100, ['ANALYZE_RECORDING']))!; vi.setSystemTime(Date.now() + 101);
  const live = (await claimJob('live', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(await persistAnalysisProbeStep(stale.id, 'stale', stale.generation, { stage: 'TEXT_ONLY', outcome: 'ACCEPTED' })).toBe(false);
  expect(await persistAnalysisProbeStep(live.id, 'live', live.generation, { stage: 'TEXT_ONLY', outcome: 'ACCEPTED' })).toBe(true);
  const db = await openDatabase(); db.close();
  expect(await claimJob('restart', Date.now() + 60999, undefined, ['ANALYZE_RECORDING'])).toBeNull();
  vi.setSystemTime(Date.now() + 61000); const next = (await claimJob('restart', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(next.analysisProbe).toMatchObject({ version: 2, model: 'gemini-3.5-flash-lite', nextStage: 1, results: [{ stage: 'TEXT_ONLY', outcome: 'ACCEPTED' }] });
  expect(await getNotes('recording')).toBeUndefined();
});
it('probe não ultrapassa cinco claims mesmo após crashes; termina sem notas', async () => {
  await ready(); await enqueueAnalysis('recording'); const first = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(first.id, 'A', first.generation, { kind: 'PERMANENT', message: 'HTTP 400' }); await retryAnalysis('recording', 'probe');
  for (let i = 0; i < 5; i++) { expect(await claimJob('crash', Date.now(), 100, ['ANALYZE_RECORDING'])).not.toBeNull(); vi.setSystemTime(Date.now() + 101); }
  expect(await claimJob('restart', Date.now(), undefined, ['ANALYZE_RECORDING'])).toBeNull();
  expect((await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')).toMatchObject({ status: 'ERROR', errorKind: 'PERMANENT', attempts: 5, analysisProbe: { done: true } });
  expect(await getNotes('recording')).toBeUndefined();
});
it('HTTP 400 permanente pode retomar o mesmo job manualmente; concorrência/replay não duplicam e a fonte é preservada', async () => {
  await ready(); await enqueueAnalysis('recording'); const job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const failure = classifyAnalysisError({ status: 400, error: { code: 'invalid_argument', message: 'Unsupported schema parameter. PRIVATE_VALUE' } });
  await failJob(job.id, 'A', job.generation, failure);
  const before = await listTranscripts('recording'); const jobs = await listJobs('recording');
  expect(await claimJob('auto', Date.now() + 999999, undefined, ['ANALYZE_RECORDING'])).toBeNull();
  expect(await Promise.all([retryAnalysis('recording'), retryAnalysis('recording')])).toEqual([1, 0]);
  expect((await listJobs('recording')).filter((item) => item.kind === 'TRANSCRIBE_CHUNK')).toEqual(jobs.filter((item) => item.kind === 'TRANSCRIBE_CHUNK'));
  expect((await listJobs('recording')).filter((item) => item.kind === 'ANALYZE_RECORDING')).toHaveLength(1);
  const resumed = (await claimJob('B', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(resumed.id).toBe(job.id); expect(resumed.attempts).toBe(1); expect(resumed.lastAnalysisDiagnostic?.apiCode).toBe('invalid_argument');
  expect(JSON.stringify(resumed.lastAnalysisDiagnostic)).not.toContain('PRIVATE_VALUE');
  expect(await retryAnalysis('recording')).toBe(0);
  expect(await persistNotes(job.id, 'A', job.generation, notesOutput(), analysisSourceKey(before))).toBe(false);
  expect(await persistNotes(resumed.id, 'B', resumed.generation, notesOutput(), analysisSourceKey(before))).toBe(true);
  expect(await retryAnalysis('recording')).toBe(0); expect(await listTranscripts('recording')).toEqual(before);
});
it('retry manual rejeita fonte incompleta e não antecipa backoff automático', async () => {
  const recording = await ready(); await enqueueAnalysis('recording'); const job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(job.id, 'A', job.generation, { kind: 'RETRYABLE', message: 'HTTP 429', retryAfterMs: 120000 });
  expect(await retryAnalysis('recording')).toBe(0);
  vi.setSystemTime(Date.now() + 120000); const next = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(next.id, 'A', next.generation, { kind: 'PERMANENT', message: 'HTTP 400' });
  await updateRecording({ ...recording, completeness: 'PARTIAL' }); expect(await retryAnalysis('recording')).toBe(0);
});
it('Lite explícito preserva job canônico, impede duplicação e registra o modelo efetivo nas notas', async () => {
  const recording = await ready(); await updateRecording({ ...recording, analysisModel: 'gemini-3.6-flash' });
  await enqueueAnalysis('recording'); const job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const before = await listTranscripts('recording');
  expect(await retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite')).toBe(0);
  await failJob(job.id, 'A', job.generation, { kind: 'RETRYABLE', message: 'HTTP 429', retryAfterMs: 120000 });
  expect(await retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite')).toBe(0);
  vi.setSystemTime(Date.now() + 120000);
  const retry = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(retry.id, 'A', retry.generation, { kind: 'PERMANENT', message: 'HTTP 400' });
  expect(await retryAnalysis('recording', 'notes', 'gemini-3.8-flash')).toBe(0);
  expect(await retryAnalysis('recording', 'probe', 'gemini-3.5-flash-lite')).toBe(0);
  expect(await Promise.all([retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite'), retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite')])).toEqual([1, 0]);
  expect(await enqueueAnalysis('recording')).toBe(false);
  const resumed = (await claimJob('B', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(resumed.id).toBe(job.id); expect(resumed.analysisModelOverride).toBe('gemini-3.5-flash-lite');
  expect(await persistNotes(resumed.id, 'B', resumed.generation, notesOutput(), analysisSourceKey(before))).toBe(true);
  expect(await getNotes('recording')).toMatchObject({ analysisModel: 'gemini-3.5-flash-lite', promptVersion: 2 });
  expect((await getRecording('recording'))?.analysisModel).toBe('gemini-3.6-flash');
  expect(await listTranscripts('recording')).toEqual(before);
  expect((await listJobs('recording')).filter((item) => item.kind === 'ANALYZE_RECORDING')).toHaveLength(1);
  expect(await retryAnalysis('recording', 'notes', 'gemini-3.5-flash-lite')).toBe(0);
});
it('enfileira uma análise para várias partes e persiste notas/estado/job atomicamente; reopen idempotente', async () => {
  await ready(2);
  expect(await Promise.all([enqueueAnalysis('recording'), enqueueAnalysis('recording')])).toEqual([true, false]);
  const job = (await claimJob('analyzer', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const before = await listTranscripts('recording');
  expect((await getRecording('recording'))?.status).toBe('PROCESSING'); expect(await getNotes('recording')).toBeUndefined();
  expect(await persistNotes(job.id, 'analyzer', job.generation, notesOutput(), analysisSourceKey(before))).toBe(true);
  const db = await openDatabase(); db.close();
  expect((await getNotes('recording'))?.output.tasks[0]).toMatchObject({ owner: 'Ana', deadline: 'sexta' });
  expect((await getRecording('recording'))?.status).toBe('COMPLETED');
  expect((await listJobs('recording')).find((item) => item.kind === 'ANALYZE_RECORDING')?.status).toBe('COMPLETE');
  expect(await listTranscripts('recording')).toEqual(before);
  expect(await enqueueAnalysis('recording')).toBe(false);
  expect(await claimJob('again', Date.now(), undefined, ['ANALYZE_RECORDING'])).toBeNull();
  expect(await retryAnalysis('recording')).toBe(0);
});
it('não analisa durante gravação nem com uma transcrição faltando', async () => {
  const recording = await ready();
  await updateRecording({ ...recording, endedAt: null, status: 'RECORDING' });
  expect(await enqueueAnalysis('recording')).toBe(false);
  await updateRecording({ ...recording, chunkCount: 2 }); await commitChunk(makeChunk(2));
  expect(await enqueueAnalysis('recording')).toBe(false);
  expect(await getNotes('recording')).toBeUndefined();
});
it('sessão parcial, índices com lacuna e sessões antigas não disparam análise', async () => {
  const recording = await ready();
  await updateRecording({ ...recording, completeness: 'PARTIAL' }); expect(await enqueueAnalysis('recording')).toBe(false);
  await updateRecording({ ...recording, analysisModel: undefined }); expect(await enqueueAnalysis('recording')).toBe(false);
  await updateRecording({ ...recording, chunkCount: 2 }); expect(await enqueueAnalysis('recording')).toBe(false);
});
it('validação inválida aborta commit sem concluir; a fonte fica intacta', async () => {
  await ready(); await enqueueAnalysis('recording'); const job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  const transcripts = await listTranscripts('recording'); const bad = notesOutput(); bad.tasks[0]!.owner = 'Inventado';
  await expect(persistNotes(job.id, 'A', job.generation, bad, analysisSourceKey(transcripts))).rejects.toThrow();
  expect(await getNotes('recording')).toBeUndefined(); expect((await getRecording('recording'))?.status).toBe('PROCESSING');
  expect((await listJobs('recording')).find((item) => item.kind === 'ANALYZE_RECORDING')?.status).toBe('PROCESSING');
  expect(await listTranscripts('recording')).toEqual(transcripts);
});
it('lease vencido/restart rejeitam resultado antigo e conservam modelo fixado', async () => {
  await ready(); await enqueueAnalysis('recording');
  const old = (await claimJob('old', Date.now(), 100, ['ANALYZE_RECORDING']))!;
  const key = analysisSourceKey(await listTranscripts('recording'));
  vi.setSystemTime(Date.now() + 101);
  const resumed = (await claimJob('restarted', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(resumed.generation).toBe(old.generation + 1);
  expect(await persistNotes(old.id, 'old', old.generation, notesOutput(), key)).toBe(false);
  expect(await persistNotes(resumed.id, 'restarted', resumed.generation, notesOutput(), key)).toBe(true);
  expect((await getNotes('recording'))?.analysisModel).toBe('gemini-3.5-flash-lite');
});
it('fonte diferente ou gravação tornada incompleta impede commit tardio', async () => {
  const recording = await ready(); await enqueueAnalysis('recording'); const job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(await persistNotes(job.id, 'A', job.generation, notesOutput(), 'outdated')).toBe(false);
  await updateRecording({ ...recording, completeness: 'PARTIAL' });
  expect(await persistNotes(job.id, 'A', job.generation, notesOutput(), analysisSourceKey(await listTranscripts('recording')))).toBe(false);
  expect(await getNotes('recording')).toBeUndefined();
});
it('erro/schema/429 tem budget finito, retry explícito conserva texto e modelo; chave ausente não gasta tentativa', async () => {
  const recording = await ready(); await enqueueAnalysis('recording');
  let job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await waitForCredentials(job.id, 'A', job.generation);
  expect((await listJobs('recording')).find((item) => item.id === analysisJobId(recording))?.attempts).toBe(0);
  await resumeCredentialJobs();
  for (let i = 1; i <= 5; i++) {
    job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
    await failJob(job.id, 'A', job.generation, classifyAnalysisError(new AnalysisError('INVALID_OUTPUT')));
    vi.setSystemTime(Date.now() + 100_000);
  }
  expect(await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING'])).toBeNull();
  expect(await getNotes('recording')).toBeUndefined(); expect((await getTranscript('chunk-1'))?.rawText).toBe(sourceText);
  expect(await retryAnalysis('recording')).toBe(1);
  job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  await failJob(job.id, 'A', job.generation, classifyAnalysisError({ status: 429, headers: new Headers({ 'Retry-After': '120' }) }));
  expect(await claimJob('A', Date.now() + 119_999, undefined, ['ANALYZE_RECORDING'])).toBeNull();
  vi.setSystemTime(Date.now() + 120_000);
  job = (await claimJob('A', Date.now(), undefined, ['ANALYZE_RECORDING']))!;
  expect(await persistNotes(job.id, 'A', job.generation, notesOutput(), analysisSourceKey(await listTranscripts('recording')))).toBe(true);
  expect(await completeExistingNotes(job.id, 'A', job.generation)).toBe(false);
});
it('crash na última tentativa sai de PROCESSING após expirar lease', async () => {
  await ready(); await enqueueAnalysis('recording');
  for (let i = 1; i <= 5; i++) {
    const job = (await claimJob('crash', Date.now(), 100, ['ANALYZE_RECORDING']))!; expect(job.attempts).toBe(i);
    vi.setSystemTime(Date.now() + 101);
  }
  expect(await claimJob('new', Date.now(), undefined, ['ANALYZE_RECORDING'])).toBeNull();
  expect((await listJobs('recording')).find((job) => job.kind === 'ANALYZE_RECORDING')).toMatchObject({ status: 'ERROR', attempts: 5 });
});
it('migração v3→v4 preserva sessão, texto, jobs e reservas do limitador', async () => {
  const transcript = makeTranscript(); const recording = analysisRecording();
  await new Promise<void>((resolve) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      for (const name of ['recordings', 'transcripts', 'jobs']) { const store = req.result.createObjectStore(name, { keyPath: 'id' }); if (name !== 'recordings') store.createIndex('recordingId', 'recordingId'); }
      req.result.createObjectStore('transcriptionRateLimits');
      const tx = req.transaction!; tx.objectStore('recordings').add(recording); tx.objectStore('transcripts').add(transcript);
      tx.objectStore('transcriptionRateLimits').put({ starts: [999], blockedUntil: 1001 }, 'test-model');
      tx.objectStore('jobs').add({ id: 'old-job', recordingId: 'recording', status: 'COMPLETE' });
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
  });
  const db = await openDatabase(); expect(db.version).toBe(5); expect(db.objectStoreNames.contains('results')).toBe(true);
  const tx = db.transaction('transcriptionRateLimits'); const rate = await new Promise((resolve) => { const req = tx.objectStore('transcriptionRateLimits').get('test-model'); req.onsuccess = () => resolve(req.result); });
  expect(rate).toEqual({ starts: [999], blockedUntil: 1001 }); db.close();
  expect(await getRecording('recording')).toEqual(recording); expect(await getTranscript('chunk-1')).toEqual(transcript); expect(await listJobs('recording')).toHaveLength(1);
});
