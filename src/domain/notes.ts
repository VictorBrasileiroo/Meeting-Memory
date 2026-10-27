import { z } from 'zod';
import { profileSchema, type Profile } from './profiles';
import { analysisModelSchema } from './analysis-models';
import { notesValidationSchema } from './notes-validation';
import { evidenceMatcher } from './note-evidence';

export const NOTES_VERSION = 1;
export const PROMPT_VERSION = 2;
export const sectionLabels = {
  topics: 'Assuntos abordados', decisions: 'Decisões', directions: 'Direcionamentos', responsibilities: 'Responsáveis', pending: 'Pendências', importantPoints: 'Pontos importantes',
  guidance: 'Orientações', methodologicalDecisions: 'Decisões metodológicas', hypotheses: 'Hipóteses', experiments: 'Experimentos', references: 'Referências mencionadas', openQuestions: 'Questões em aberto',
  requirements: 'Requisitos', architectureDecisions: 'Decisões arquiteturais', requestedChanges: 'Alterações solicitadas', issues: 'Bugs e issues', risks: 'Riscos',
  concepts: 'Conceitos', definitions: 'Definições', examples: 'Exemplos', formulas: 'Fórmulas', emphasizedPoints: 'Observações enfatizadas', questions: 'Dúvidas', assessmentTopics: 'Conteúdos de avaliação mencionados',
} as const;
export type SectionKind = keyof typeof sectionLabels;
export const profileSections: Record<Profile, readonly SectionKind[]> = {
  general: ['topics', 'decisions', 'directions', 'responsibilities', 'pending', 'importantPoints'],
  research: ['topics', 'guidance', 'methodologicalDecisions', 'hypotheses', 'experiments', 'references', 'pending', 'openQuestions', 'importantPoints'],
  development: ['topics', 'decisions', 'requirements', 'architectureDecisions', 'requestedChanges', 'issues', 'risks', 'responsibilities', 'pending'],
  class: ['topics', 'concepts', 'definitions', 'examples', 'formulas', 'emphasizedPoints', 'questions', 'assessmentTopics'],
};
const text = z.string().trim().min(1).max(6000);
const sourceRef = z.strictObject({ chunkId: z.string().min(1), quote: text });
const evidence = z.array(sourceRef).min(1).max(12);
export const noteItemSchema = z.strictObject({ text, nature: z.enum(['established', 'suggestion', 'hypothesis']), evidence });
export function notesOutputSchema(profile?: Profile) {
  return z.strictObject({
    title: text.nullable(),
    summary: z.array(noteItemSchema).max(30),
    sections: z.array(z.strictObject({ kind: z.enum((profile ? profileSections[profile] : Object.keys(sectionLabels)) as [SectionKind, ...SectionKind[]]), items: z.array(noteItemSchema).max(200) })).max(24),
    tasks: z.array(z.strictObject({ description: text, owner: text.nullable(), deadline: text.nullable(), status: z.literal('defined'), evidence })).max(200),
  });
}
export type NotesOutput = z.infer<ReturnType<typeof notesOutputSchema>>;
// Interactions documents a subset of JSON Schema. Keep the full Zod checks
// locally, but send nullable type arrays/enums and only supported constraints.
export function notesJsonSchema(profile: Profile): Record<string, unknown> {
  function convert(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== 'object') return value;
    const source = value as Record<string, unknown>;
    if (Array.isArray(source.anyOf) && source.anyOf.length === 2) {
      const nullable = source.anyOf as Record<string, unknown>[];
      const nonNull = nullable.find((item) => item.type !== 'null');
      if (nonNull && nullable.some((item) => item.type === 'null')) {
        const converted = convert(nonNull) as Record<string, unknown>;
        return { ...converted, type: [converted.type, 'null'] };
      }
    }
    return Object.fromEntries(Object.entries(source).flatMap(([key, value]) => {
      if (['$schema', 'minLength', 'maxLength'].includes(key)) return [];
      return [[key === 'const' ? 'enum' : key, key === 'const' ? [value] : convert(value)]];
    }));
  }
  return convert(z.toJSONSchema(notesOutputSchema(profile))) as Record<string, unknown>;
}
export const meetingNotesSchema = z.strictObject({
  recordingId: z.string().min(1), profile: profileSchema, analysisModel: analysisModelSchema,
  schemaVersion: z.literal(NOTES_VERSION), promptVersion: z.union([z.literal(1), z.literal(PROMPT_VERSION)]), createdAt: z.number().int().nonnegative(), sourceKey: z.string(),
  output: notesOutputSchema(),
  validation: notesValidationSchema.optional(),
});
export type MeetingNotes = z.infer<typeof meetingNotesSchema>;
export function validateNotesOutput(value: unknown, profile: Profile, sources: readonly { chunkId: string; rawText: string }[]): NotesOutput {
  const output = notesOutputSchema(profile).parse(value);
  const kinds = output.sections.map((section) => section.kind);
  if (new Set(kinds).size !== kinds.length) throw new Error('DUPLICATE_SECTION');
  const original = new Map(sources.map((source) => [source.chunkId, source.rawText]));
  for (const item of [...output.summary, ...output.sections.flatMap((section) => section.items), ...output.tasks]) {
    for (const ref of item.evidence) if (!original.get(ref.chunkId)?.includes(ref.quote)) throw new Error('INVALID_EVIDENCE');
  }
  for (const task of output.tasks) {
    for (const value of [task.owner, task.deadline]) if (value !== null && !task.evidence.some((ref) => evidenceMatcher(ref.quote)(value))) throw new Error('UNSUPPORTED_ASSIGNMENT');
  }
  for (const section of output.sections) if (['decisions', 'methodologicalDecisions', 'architectureDecisions'].includes(section.kind)
    && section.items.some((item) => item.nature !== 'established')) throw new Error('SUGGESTION_IS_NOT_DECISION');
  if (profile === 'class' && output.tasks.length) throw new Error('TASKS_OUTSIDE_PROFILE');
  // Exact repeated facts across overlapping parts collapse only in the derived notes.
  const unique = <T>(items: T[], key: (item: T) => string) => items.filter((item, index) => items.findIndex((other) => key(other) === key(item)) === index);
  output.summary = unique(output.summary, (item) => item.text);
  output.sections = output.sections.map((section) => ({ ...section, items: unique(section.items, (item) => `${item.nature}:${item.text}`) }));
  output.tasks = unique(output.tasks, (task) => JSON.stringify([task.description, task.owner, task.deadline]));
  return output;
}
