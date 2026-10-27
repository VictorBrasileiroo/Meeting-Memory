import { afterEach, expect, it, vi } from 'vitest';
import { GoogleGeminiAnalysisClient } from '../src/gemini/analysis';
import { ANALYSIS_PROBE_INPUT, ANALYSIS_PROBE_MODEL, ANALYSIS_PROBE_STAGES } from '../src/domain/analysis-probe';
import { notesJsonSchema } from '../src/domain/notes';

afterEach(() => vi.unstubAllGlobals());
it('cinco requests sintéticos começam com texto livre no Lite e acrescentam configurações sem dados da sessão', async () => {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    expect(new URL(request.url).pathname).toBe('/v1beta/interactions'); bodies.push(JSON.parse(await request.text()));
    return new Response(JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"ok":true}' }] }] }), { headers: { 'content-type': 'application/json' } });
  }));
  const client = new GoogleGeminiAnalysisClient('test-only-key');
  for (const stage of ANALYSIS_PROBE_STAGES) await client.probe(ANALYSIS_PROBE_MODEL, 'development', stage, new AbortController().signal);
  expect(bodies).toHaveLength(5);
  expect(bodies.shift()).toEqual({ model: ANALYSIS_PROBE_MODEL, store: false, input: 'Responda apenas OK.' });
  for (const body of bodies) {
    expect(body).toMatchObject({ model: ANALYSIS_PROBE_MODEL, store: false, input: ANALYSIS_PROBE_INPUT });
    expect(body).not.toHaveProperty('tools'); expect(body).not.toHaveProperty('previous_interaction_id');
  }
  expect(bodies[0]).not.toHaveProperty('generation_config');
  expect(bodies[1]).toEqual({ ...bodies[0], generation_config: { max_output_tokens: 32768 } });
  expect(bodies[2]).toEqual({ ...bodies[1], response_format: { type: 'text', mime_type: 'application/json', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } } });
  expect(bodies[3]).toEqual({ ...bodies[2], response_format: { type: 'text', mime_type: 'application/json', schema: notesJsonSchema('development') } });
});
it('probe propaga falha sem retry interno ou troca de modelo', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'invalid_request', message: 'Request contains an invalid argument.' } }), { status: 400, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(new GoogleGeminiAnalysisClient('test-only-key').probe('gemini-3.6-flash', 'development', 'NOTES_SCHEMA', new AbortController().signal)).rejects.toMatchObject({ status: 400 });
  expect(fetch).toHaveBeenCalledOnce();
});
