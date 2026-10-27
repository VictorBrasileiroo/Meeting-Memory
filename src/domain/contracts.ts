import { z } from 'zod';
import { profileSchema } from './profiles';
import { failureSchema, recordingStateSchema } from './recording-state';

export const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.enum(['foundation', 'mock', 'capture']),
  status: recordingStateSchema,
  revision: z.number().int().nonnegative(),
  recordingId: z.string().uuid().nullable(),
  targetTabId: z.number().int().nonnegative().nullable().optional(),
  interrupted: z.boolean().optional(),
  captureEndReason: z.enum(['MANUAL', 'TAB_CLOSED', 'SOURCE_LOST']).optional(),
  processingStage: z.enum(['transcribing', 'preparing', 'analyzing']).optional(),
  profile: profileSchema,
  startedAt: z.number().int().nonnegative().nullable(),
  startRequestedAt: z.number().int().nonnegative().nullable().optional(),
  endedAt: z.number().int().nonnegative().nullable(),
  failure: failureSchema.nullable(),
}).superRefine((snapshot, ctx) => {
  if ((snapshot.status === 'ERROR') !== (snapshot.failure !== null)) {
    ctx.addIssue({ code: 'custom', message: 'Erro deve preservar contexto de falha.' });
  }
  if (snapshot.status !== 'IDLE' && snapshot.recordingId === null) {
    ctx.addIssue({ code: 'custom', message: 'Sessão ativa exige identificador.' });
  }
  if (snapshot.status === 'IDLE' && (snapshot.recordingId !== null || snapshot.startedAt !== null || snapshot.endedAt !== null)) {
    ctx.addIssue({ code: 'custom', message: 'Estado inicial não representa gravação.' });
  }
  if (['RECORDING', 'STOPPING', 'PROCESSING', 'COMPLETED'].includes(snapshot.status) && snapshot.startedAt === null) {
    ctx.addIssue({ code: 'custom', message: 'Estado exige início conhecido.' });
  }
  if (['PROCESSING', 'COMPLETED'].includes(snapshot.status) && snapshot.endedAt === null) {
    ctx.addIssue({ code: 'custom', message: 'Processamento exige encerramento.' });
  }
  if (snapshot.failure?.phase === 'processing' && (snapshot.startedAt === null || snapshot.endedAt === null)) {
    ctx.addIssue({ code: 'custom', message: 'Recuperação de processamento exige captura encerrada.' });
  }
  if (snapshot.endedAt !== null && (snapshot.startedAt === null || snapshot.endedAt < snapshot.startedAt)) {
    ctx.addIssue({ code: 'custom', message: 'Intervalo inválido.' });
  }
  if (snapshot.mode === 'foundation' && snapshot.status !== 'IDLE') {
    ctx.addIssue({ code: 'custom', message: 'Fundação normal não permite gravação simulada.' });
  }
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export function initialSnapshot(mode: Snapshot['mode'] = 'foundation'): Snapshot {
  return { schemaVersion: 1, mode, status: 'IDLE', revision: 0, recordingId: null, targetTabId: null, interrupted: false, profile: 'general', startedAt: null, startRequestedAt: null, endedAt: null, failure: null };
}

// Contratos mínimos de apresentação; não são schemas de resposta Gemini.
export type DisplaySection = { id: string; title: string; items: string[] };
export type SessionView = {
  status: 'PROCESSING' | 'COMPLETED' | 'ERROR';
  interrupted: boolean;
  title: string;
  summary: string[];
  sections: DisplaySection[];
  transcript: string | null;
};
export function visibleSections(sections: DisplaySection[]): DisplaySection[] {
  return sections.map((section) => ({ ...section, items: section.items.filter((item) => item.trim().length > 0) }))
    .filter((section) => section.items.length > 0);
}
