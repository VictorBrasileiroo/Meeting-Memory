// Provider errors can echo user input. Persist only a projection onto this
// fixed technical vocabulary, never a raw SDK error/message/body/headers.
export type AnalysisDiagnostic = {
  sdkVersion: '2.24.0'; endpoint: 'interactions'; httpStatus: number;
  apiCode: string | number | null; codeAvailable: boolean; messageAvailable: boolean;
  messageSanitized: string;
  genericMessage?: boolean; messageRedacted?: boolean;
  detailCount?: number;
  fieldViolations?: { fieldSanitized: string; descriptionSanitized: string }[];
};
const codes = new Set(['invalid_argument', 'invalid_request', 'invalid_request_error', 'bad_request', 'failed_precondition', 'permission_denied', 'unauthenticated', 'resource_exhausted', 'not_found', 'model_not_found', 'internal', 'unavailable']);
const vocabulary = new Set(`invalid json payload received unknown name field fields at in of the a an is are not supported unsupported allowed required must be cannot empty missing schema response_format mime_type application type text string null object array boolean integer number properties items prefixitems required additionalproperties anyof oneof enum const minimum maximum minitems maxitems minlength maxlength propertyordering generation_config max_output_tokens thinking_level thinking_budget temperature top_p top_k model input system_instruction store background previous_interaction_id parameter parameters value values limit exceeds exceeded maximum minimum too large complex complexity nesting depth constraints constraint format key api valid please use request response configuration for this and with false true found expected has no unexpected unrecognized does accept only gemini-3.6-flash`.split(/\s+/));
for (const word of ['contains', 'argument', 'arguments']) vocabulary.add(word);
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function sanitize(message: string): string {
  const tokens = message.slice(0, 16_384).match(/[\p{L}\p{N}_-]+|[^\p{L}\p{N}_\s-]+/gu) ?? [];
  return tokens.map((token) => vocabulary.has(token.toLowerCase()) ? token.toLowerCase()
    : /^[.:,;[\](){}'"]{1,8}$/.test(token) ? token : '[omitido]').join(' ')
    .replace(/(?:\[omitido\]\s*)+/g, '[omitido] ').trim().slice(0, 600);
}
export function analysisDiagnostic(error: unknown): AnalysisDiagnostic | undefined {
  const sdk = object(error);
  if (typeof sdk.status !== 'number' || !Number.isInteger(sdk.status) || sdk.status < 400 || sdk.status > 599) return undefined;
  let payload = object(sdk.error);
  // SDK 2.24.0 exposes error directly or wraps a Google-style {error:{...}}.
  if (payload.error && typeof payload.error === 'object') payload = object(payload.error);
  const rawCode = payload.code ?? payload.status;
  const apiCode = typeof rawCode === 'number' && Number.isInteger(rawCode) && rawCode >= 0 && rawCode <= 599 ? rawCode
    : typeof rawCode === 'string' && codes.has(rawCode.toLowerCase()) ? rawCode.toLowerCase() : null;
  const rawMessage = typeof payload.message === 'string' ? payload.message : typeof sdk.message === 'string' ? sdk.message : '';
  const safe = sanitize(rawMessage);
  // Google RPC details are optional. Their presence is observed, never assumed
  // for Interactions. Only fixed keys are read; every value uses the same filter.
  const details = Array.isArray(payload.details) ? payload.details : [];
  const fieldViolations = details.slice(0, 10).flatMap((detail) => {
    const violations = object(detail).fieldViolations;
    if (!Array.isArray(violations)) return [];
    return violations.slice(0, 10).map((violation) => {
      const item = object(violation);
      return { fieldSanitized: sanitize(typeof item.field === 'string' ? item.field : ''),
        descriptionSanitized: sanitize(typeof item.description === 'string' ? item.description : '') };
    });
  });
  return { sdkVersion: '2.24.0', endpoint: 'interactions', httpStatus: sdk.status, apiCode,
    codeAvailable: rawCode !== undefined, messageAvailable: rawMessage.length > 0,
    messageSanitized: safe || 'Mensagem detalhada indisponível.',
    genericMessage: /^(?:the )?request contains an invalid argument\.?$/i.test(rawMessage.trim()),
    messageRedacted: safe.includes('[omitido]'), detailCount: details.length, fieldViolations };
}
