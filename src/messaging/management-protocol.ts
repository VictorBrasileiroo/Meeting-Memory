import { z } from 'zod';

const envelope = { protocolVersion: z.literal(1), requestId: z.string().uuid() };
export const managementRequestSchema = z.strictObject({
  ...envelope, target: z.literal('background-management'),
  type: z.enum(['REMOVE_RECORDING_AUDIO', 'DELETE_RECORDING']),
  recordingId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(),
});
export type ManagementRequest = z.infer<typeof managementRequestSchema>;
export const managementResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ...envelope, ok: z.literal(true), result: z.strictObject({ recordingId: z.string().uuid(), type: z.enum(['REMOVE_RECORDING_AUDIO', 'DELETE_RECORDING']), removedAudioBytes: z.number().nonnegative(), cleanupPending: z.boolean() }) }),
  z.strictObject({ ...envelope, ok: z.literal(false), code: z.enum(['INVALID_MESSAGE', 'FORBIDDEN', 'CONFLICT', 'PROTECTED', 'STORAGE_FAILURE']), message: z.string() }),
]);
export type ManagementResponse = z.infer<typeof managementResponseSchema>;
export function isTrustedManager(sender: Pick<chrome.runtime.MessageSender, 'id' | 'url'>, extensionId: string): boolean {
  try { const url = new URL(sender.url ?? ''); return sender.id === extensionId && url.protocol === 'chrome-extension:' && url.hostname === extensionId && url.pathname === '/src/library/library.html'; }
  catch { return false; }
}
