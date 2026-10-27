import { z } from 'zod';
export const notesIssueCodes = ['EVIDENCE_NOT_FOUND', 'WRONG_PART', 'UNKNOWN_PART', 'UNSUPPORTED_OWNER', 'UNSUPPORTED_DEADLINE', 'INVALID_NATURE', 'DUPLICATE_SECTION', 'TASKS_OUTSIDE_PROFILE', 'SECTION_LIMIT'] as const;
export const notesValidationSchema = z.strictObject({
  version: z.literal(1), omittedItems: z.number().int().nonnegative().max(6000),
  recoveredQuotes: z.number().int().nonnegative().max(72000),
  issues: z.array(z.strictObject({ code: z.enum(notesIssueCodes), count: z.number().int().positive().max(72000) })).max(notesIssueCodes.length),
});
export type NotesValidation = z.infer<typeof notesValidationSchema>;

export function notesLimitation(validation: NotesValidation): string {
  return validation.omittedItems ? `${validation.omittedItems} ${validation.omittedItems === 1 ? 'item foi omitido' : 'itens foram omitidos'} por falta de suporte confiável. Consulte a transcrição para revisar o contexto completo.`
    : validation.issues.some(issue => issue.code === 'DUPLICATE_SECTION') ? 'Seções repetidas foram reunidas. As fontes foram preservadas.' : 'Citações com diferenças de formatação foram recuperadas da transcrição original.';
}
