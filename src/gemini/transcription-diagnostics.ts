// Only called in the explicitly selected development diagnostic build.
// No scalar values, headers, text, audio, file URIs or raw response references.
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function fields(value: unknown) {
  return Object.entries(record(value)).filter(([key]) => /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(key)).slice(0, 40)
    .map(([name, item]) => ({ name, type: item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item }));
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
export function transcriptionStructure(value: unknown) {
  const response = record(value);
  const steps = array(response.steps);
  const content = steps.flatMap((step) => array(record(step).content));
  const annotations = content.flatMap((item) => array(record(item).annotations));
  return {
    fields: fields(response),
    hasInteractionId: typeof response.id === 'string',
    hasOutputText: typeof response.output_text === 'string',
    stepCount: steps.length,
    contentCount: content.length,
    annotationCount: annotations.length,
    wordInfoCount: annotations.filter((item) => record(item).type === 'word_info').length,
    speakerCount: new Set(annotations.map((item) => record(item).speaker).filter((item) => typeof item === 'string' && item.length > 0)).size,
    stepFields: steps.slice(0, 3).map(fields),
    contentFields: content.slice(0, 3).map(fields),
    annotationFields: annotations.slice(0, 3).map(fields),
  };
}
