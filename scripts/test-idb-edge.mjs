import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = resolve('.verification');
mkdirSync(root, { recursive: true });
const source = readFileSync('src/storage/recordings.ts', 'utf8');
const policy = readFileSync('src/queue/job-policy.ts', 'utf8');
const compile = (text) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
const compiled = compile(policy) + '\n' + compile(source);
const test = `
async function run() {
  const id = 'edge-test-' + crypto.randomUUID();
  const recording = { id, createdAt: Date.now(), startedAt: Date.now(), endedAt: null, profile: 'general', status: 'RECORDING', revision: 0, durationMs: 0, chunkCount: 0, completeness: 'UNKNOWN', interruption: null };
  await createRecording(recording);
  if ((await getRecording(id))?.id !== id) throw new Error('create/read');
  const db = await openDatabase();
  if (db.version !== DB_VERSION || !['recordings','activeSession','chunks','fragments','jobs'].every(x => db.objectStoreNames.contains(x))) throw new Error('upgrade/schema');
  db.close();
  const makeChunk = (index, chunkId) => ({ id: chunkId, recordingId: id, index, recorderId: 'rec', approximateStartMs: 0, approximateEndMs: 1000, measuredDurationMs: null, overlapMs: 0, mimeType: 'audio/webm', blob: new Blob(['audio']), status: 'PENDING', attempts: 0, error: null, boundary: { requestedStartMs: 0, requestedEndMs: 1000, observedStartMs: 0, observedStopMs: 1000, interrupted: false, durationSource: 'clock', requestedBitrate: 128000, observedBitrate: 128000, sizeBytes: 5 } });
  await commitChunk(makeChunk(1, id + ':one'));
  let aborted = false;
  try { await commitChunk(makeChunk(1, id + ':duplicate')); } catch { aborted = true; }
  if (!aborted || (await listChunks(id)).length !== 1 || (await listJobs(id)).length !== 1) throw new Error('unique/transaction abort');
  await addFragment({ id: id + ':f0', recordingId: id, recorderId: id + ':rec', sequence: 0, blob: new Blob(['a']) });
  await addFragment({ id: id + ':f1', recordingId: id, recorderId: id + ':rec', sequence: 1, blob: new Blob(['b']) });
  if ((await listFragments(id + ':rec')).map(x => x.sequence).join() !== '0,1') throw new Error('fragment order');
  const first = await claimJob('owner-a', 1000, 100);
  if (!first || first.generation !== 1) throw new Error('claim');
  if (await claimJob('owner-b', 1050, 100)) throw new Error('double claim');
  if (!(await renewJobLease(first.id, 'owner-a', 1, 1050, 100))) throw new Error('renew');
  if (await renewJobLease(first.id, 'owner-b', 1, 1051, 100)) throw new Error('wrong owner');
  if (await renewJobLease(first.id, 'owner-a', 0, 1051, 100)) throw new Error('stale renew');
  if (await claimJob('owner-b', 1101, 100)) throw new Error('renewed lease claim');
  const second = await claimJob('owner-b', 1151, 100);
  if (!second || second.generation !== 2) throw new Error('lease expiry');
  if (await finishChunkTest(first.id, 'owner-a', 1, null, 1152)) throw new Error('stale generation');
  if (!(await finishChunkTest(second.id, 'owner-b', 2, null, 1152))) throw new Error('finish');
  if ((await listJobs(id))[0].status !== 'COMPLETE') throw new Error('job commit');
  if (await renewJobLease(second.id, 'owner-b', 2, 1153, 100)) throw new Error('completed renew');
  await commitChunk(makeChunk(2, id + ':retry'));
  const retry = await claimJob('owner-a', 2000, 100);
  if (!retry || retry.chunkId !== id + ':retry') throw new Error('retry claim');
  if (!(await finishChunkTest(retry.id, 'owner-a', retry.generation, {kind:'RETRYABLE',message:'temporary'}, 2001))) throw new Error('retry settle');
  const retryJob = (await listJobs(id)).find(x => x.id === retry.id);
  if (!retryJob || retryJob.errorKind !== 'RETRYABLE' || await claimJob('owner-b', retryJob.nextAttemptAt - 1, 100)) throw new Error('retry backoff');
  await commitChunk({ ...makeChunk(3, id + ':invalid'), status: 'ERROR', error: 'Duração acima do limite.' });
  const invalid = (await listJobs(id)).find(x => x.chunkId === id + ':invalid');
  if (!invalid || invalid.status !== 'ERROR' || invalid.errorKind !== 'PERMANENT' || invalid.attempts !== 0 || (await getChunk(id + ':invalid')).blob.size === 0) throw new Error('permanent chunk');
  await commitChunk({ ...makeChunk(4, id + ':empty'), blob: new Blob() });
  const empty = (await listJobs(id)).find(x => x.chunkId === id + ':empty');
  if (!empty || empty.errorKind !== 'PERMANENT' || empty.attempts !== 0 || !(await getChunk(id + ':empty'))) throw new Error('empty permanent');
  await removeFragments(id + ':rec');
  if ((await listFragments(id + ':rec')).length !== 0) throw new Error('fragment cleanup');
  if ((await getRecording(id))?.id !== id) throw new Error('reopen');
  document.querySelector('#result').textContent = 'PASS IDB_EDGE_NATIVE';
}
run().catch(error => { document.querySelector('#result').textContent = 'FAIL ' + error.message; });
`;
const html = `<html><body><pre id="result">WAIT</pre><script>${compiled}\n${test}</script></body></html>`;
const file = resolve(root, 'idb-harness.html'); writeFileSync(file, html);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const result = spawnSync(edge, ['--headless=old', '--disable-gpu', '--disable-gpu-compositing', '--disable-software-rasterizer', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--virtual-time-budget=10000', '--dump-dom', '--user-data-dir=' + resolve(root, 'edge-idb-profile-' + process.pid), pathToFileURL(file).href], { encoding: 'utf8', timeout: 30000 });
if (!result.stdout.includes('PASS IDB_EDGE_NATIVE')) { process.stderr.write((result.stdout + '\n' + result.stderr).slice(-4000)); process.exit(1); }
process.stdout.write('PASS: IndexedDB nativo no Edge: schema, commit/abort, índice único, fragmentos, lease, generation e reopen.\n');
