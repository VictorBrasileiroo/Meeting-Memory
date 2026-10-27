import { afterEach, expect, it, vi } from 'vitest';
import { GoogleGeminiAnalysisClient, classifyAnalysisError } from '../src/gemini/analysis';
import { analysisDiagnostic } from '../src/domain/analysis-diagnostic';
import { analysisRecording, sourceText } from './fixtures/notes';
import { makeChunk, makeTranscript } from './fixtures/recording';

afterEach(() => vi.unstubAllGlobals());
it('não oculta gramática técnica da mensagem genérica, mas também não inventa o campo inválido', () => {
  const diagnostic = analysisDiagnostic({ status: 400, error: { code: 'invalid_request', message: 'Request contains an invalid argument.' } });
  expect(diagnostic).toMatchObject({ messageSanitized: 'request contains an invalid argument .', genericMessage: true, messageRedacted: false, detailCount: 0, fieldViolations: [] });
});
it('extrai violações de campo quando presentes sem expor valores ou supor que Interactions sempre as retorna', () => {
  const diagnostic = analysisDiagnostic({ status: 400, error: { error: { code: 'invalid_request', message: 'Request contains an invalid argument.', details: [
    { fieldViolations: [{ field: 'response_format.schema', description: 'Unsupported schema PRIVATE_VALUE João 12345678901.' }], metadata: { secret: 'PRIVATE_VALUE' } },
  ] } } });
  expect(diagnostic?.detailCount).toBe(1);
  expect(diagnostic?.fieldViolations?.[0]?.fieldSanitized).toBe('response_format . schema');
  expect(diagnostic?.fieldViolations?.[0]?.descriptionSanitized).toContain('unsupported schema');
  const safe = JSON.stringify(diagnostic);
  for (const secret of ['PRIVATE_VALUE', 'João', '12345678901', 'metadata']) expect(safe).not.toContain(secret);
});
it.each([
  { error: { code: 'invalid_argument', message: 'Unknown name "schema" at response_format. Private meeting: Projeto Aurora.' } },
  { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received. Unknown name "schema" at response_format. Private meeting: Projeto Aurora.' } },
])('SDK 2.24.0 expõe code/message do HTTP 400; guarda só projeção segura e não repete chamada', async (body) => {
  let sent: unknown; const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init); sent = JSON.parse(await req.text());
    return new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/json' } });
  }); vi.stubGlobal('fetch', fetch);
  let caught: unknown;
  try { await new GoogleGeminiAnalysisClient('test-only-key').analyze({ ...analysisRecording(), analysisModel: 'gemini-3.6-flash' }, [makeChunk()], [{ ...makeTranscript(), rawText: sourceText }], new AbortController().signal); } catch (error) { caught = error; }
  const failure = classifyAnalysisError(caught);
  expect(fetch).toHaveBeenCalledOnce(); expect(failure.kind).toBe('PERMANENT');
  expect(failure.message).toContain('Isso não confirma falha da chave');
  expect(failure.analysisDiagnostic).toMatchObject({ httpStatus: 400, messageAvailable: true, codeAvailable: true });
  expect(failure.analysisDiagnostic?.apiCode).toBe(body.error.code);
  expect(failure.analysisDiagnostic?.messageSanitized).toContain('response_format');
  expect(failure.analysisDiagnostic?.messageSanitized).toContain('schema');
  const safe = JSON.stringify(failure); expect(safe).not.toContain('Projeto'); expect(safe).not.toContain('Aurora'); expect(safe).not.toContain(sourceText); expect(safe).not.toContain('test-only-key');
  expect(sent).toMatchObject({ model: 'gemini-3.6-flash', store: false, response_format: { type: 'text', mime_type: 'application/json' }, generation_config: { max_output_tokens: 32768 } });
  expect((sent as { response_format: object }).response_format).not.toHaveProperty('schema');
});
it('redige valores sensíveis, unicode, URLs, credenciais, nomes e códigos desconhecidos sem copiar body/headers', () => {
  const secret = 'pretend-secret-123456';
  const diagnostic = analysisDiagnostic({ status: 400, error: { error: { code: secret, message: `Invalid schema: 王秘密 João CPF 12345678901 https://private.test ${secret} "full transcript"` } }, headers: { authorization: secret }, body: secret });
  expect(diagnostic?.apiCode).toBeNull(); expect(diagnostic?.codeAvailable).toBe(true);
  const safe = JSON.stringify(diagnostic);
  for (const value of [secret, '王', 'João', '12345678901', 'private.test', 'full', 'transcript', 'authorization']) expect(safe).not.toContain(value);
  expect(diagnostic?.messageSanitized).toContain('invalid schema'); expect(diagnostic?.messageSanitized).toContain('[omitido]');
});
it('sem detalhe real não fabrica uma causa e distingue ausência de código/mensagem', () => {
  expect(analysisDiagnostic({ status: 400 })).toMatchObject({ apiCode: null, codeAvailable: false, messageAvailable: false, messageSanitized: 'Mensagem detalhada indisponível.' });
  expect(analysisDiagnostic(new TypeError('offline'))).toBeUndefined();
});
