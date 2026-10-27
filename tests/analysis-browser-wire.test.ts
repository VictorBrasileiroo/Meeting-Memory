import { afterEach, expect, it, vi } from 'vitest';
import { ANALYSIS_MODEL_IDS } from '../src/domain/analysis-models';
import { ANALYSIS_PROBE_MODEL, ANALYSIS_PROBE_STAGES } from '../src/domain/analysis-probe';
import { GoogleGeminiAnalysisClient } from '../src/gemini/analysis';
import { analysisRecording, emptyOutput } from './fixtures/notes';
import { makeChunk, makeTranscript } from './fixtures/recording';

// Exercise the SDK export that Vite resolves for the extension, with HTTP
// intercepted. No API credentials, meeting data or network calls are needed.
vi.mock('@google/genai', async () => import('@google/genai/web'));
afterEach(() => vi.unstubAllGlobals());

function interceptRequests() {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    expect(new URL(request.url).pathname).toBe('/v1beta/interactions');
    bodies.push(JSON.parse(await request.text()));
    return new Response(JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(emptyOutput()) }] }] }), { headers: { 'content-type': 'application/json' } });
  }));
  return bodies;
}

it.each(ANALYSIS_MODEL_IDS)('browser SDK sends no deprecated sampling settings for %s', async (model) => {
  const bodies = interceptRequests();
  await new GoogleGeminiAnalysisClient('test-only-key').analyze({ ...analysisRecording(), analysisModel: model }, [makeChunk()], [makeTranscript()], new AbortController().signal);
  expect(bodies).toHaveLength(1);
  const body = bodies[0]!;
  expect(body).toMatchObject({ model, store: false });
  expect(Object.keys(body).sort()).toEqual(['generation_config', 'input', 'model', 'response_format', 'store', 'system_instruction']);
  expect(body.generation_config).toEqual({ max_output_tokens: 32768 });
  expect(body.response_format).toEqual({ type: 'text', mime_type: 'application/json' });
  expect(body.system_instruction).toContain('Contrato JSON:');
  expect(JSON.stringify(body.response_format)).not.toMatch(/"(?:temperature|top_p|top_k|candidate_count)"/);
});

it.each(ANALYSIS_PROBE_STAGES)('browser SDK adds no sampling defaults to probe %s', async (stage) => {
  const bodies = interceptRequests();
  await new GoogleGeminiAnalysisClient('test-only-key').probe(ANALYSIS_PROBE_MODEL, 'development', stage, new AbortController().signal);
  expect(bodies).toHaveLength(1);
  const body = bodies[0]!;
  expect(body).toMatchObject({ model: ANALYSIS_PROBE_MODEL, store: false });
  if (stage === 'TEXT_ONLY') {
    expect(body).toEqual({ model: ANALYSIS_PROBE_MODEL, store: false, input: 'Responda apenas OK.' });
    return;
  }
  const keys = ['input', 'model', 'response_format', 'store', 'system_instruction'];
  if (stage === 'JSON_ONLY') expect(body).not.toHaveProperty('generation_config');
  else { keys.push('generation_config'); expect(body.generation_config).toEqual({ max_output_tokens: 32768 }); }
  expect(Object.keys(body).sort()).toEqual(keys.sort());
});
