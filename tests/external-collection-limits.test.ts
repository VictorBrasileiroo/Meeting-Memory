import { expect, it } from 'vitest';
import { notesOutputSchema } from '../src/domain/notes';
import { notesIssueCodes, notesValidationSchema } from '../src/domain/notes-validation';

const base = () => ({ title: null, summary: [], sections: [], tasks: [] });
const ref = { chunkId: 'p1', quote: 'Fonte sintética para teste.' };
const note = { text: 'Nota sintética.', nature: 'established', evidence: [ref] };
const cases = [
  { name: 'resumo', limit: 30, property: 'text', valid: note, input: (items: unknown[]) => ({ ...base(), summary: items }) },
  { name: 'seções', limit: 24, property: 'kind', valid: { kind: 'topics', items: [] }, input: (items: unknown[]) => ({ ...base(), sections: items }) },
  { name: 'itens por seção', limit: 200, property: 'text', valid: note, input: (items: unknown[]) => ({ ...base(), sections: [{ kind: 'topics', items }] }) },
  { name: 'tarefas', limit: 200, property: 'description', valid: { description: 'Tarefa sintética.', owner: null, deadline: null, status: 'defined', evidence: [ref] }, input: (items: unknown[]) => ({ ...base(), tasks: items }) },
  { name: 'evidências', limit: 12, property: 'chunkId', valid: ref, input: (evidence: unknown[]) => ({ ...base(), summary: [{ ...note, evidence }] }) },
];

// Regression for GHSA-mrhx-c7xc-m3w5: rejection must happen before walking
// attacker-sized collections and allocating one issue per invalid element.
it.each(cases)('rejeita $name excessivo antes de validar seus 50 mil elementos', ({ limit, property, input }) => {
  let reads = 0;
  const invalid = Object.defineProperty({}, property, { enumerable: true, get: () => { reads++; return null; } });
  const result = notesOutputSchema('general').safeParse(input(Array(50_000).fill(invalid)));
  expect(result.success).toBe(false);
  expect(reads).toBe(0);
  if (!result.success) expect(result.error.issues).toEqual([expect.objectContaining({ code: 'too_big', maximum: limit })]);
});

it.each(cases)('preserva o limite aceito para $name e recusa o próximo elemento', ({ limit, valid, input }) => {
  const schema = notesOutputSchema('general');
  expect(schema.safeParse(input(Array(limit).fill(valid))).success).toBe(true);
  expect(schema.safeParse(input(Array(limit + 1).fill(valid))).success).toBe(false);
});

it('limita o relatório externo de validação antes de percorrer códigos inválidos', () => {
  let reads = 0;
  const invalid = Object.defineProperty({}, 'code', { enumerable: true, get: () => { reads++; return 'invalid'; } });
  const result = notesValidationSchema.safeParse({ version: 1, omittedItems: 0, recoveredQuotes: 0, issues: Array(50_000).fill(invalid) });
  expect(result.success).toBe(false);
  expect(reads).toBe(0);
  if (!result.success) expect(result.error.issues).toEqual([expect.objectContaining({ code: 'too_big', maximum: notesIssueCodes.length })]);
});
