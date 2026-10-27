import { z } from 'zod';
import { profileSchema } from '../domain/profiles';
import { snapshotSchema } from '../domain/contracts';

export const PROTOCOL_VERSION = 1 as const;
const envelope = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: z.string().uuid(),
  target: z.literal('background'),
};
const mutation = {
  ...envelope,
  expectedRevision: z.number().int().nonnegative(),
  recordingId: z.string().uuid().nullable(),
};
export const requestSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...envelope, type: z.literal('GET_SNAPSHOT') }),
  z.strictObject({ ...mutation, type: z.literal('START_CAPTURE'), payload: z.strictObject({ profile: profileSchema }) }),
  z.strictObject({ ...mutation, type: z.literal('STOP_CAPTURE') }),
  z.strictObject({ ...mutation, type: z.literal('RESET_CAPTURE') }),
  z.strictObject({ ...mutation, type: z.literal('RECOVER_CAPTURE') }),
  z.strictObject({ ...mutation, recordingId: z.string().uuid(), type: z.literal('RETRY_ANALYSIS'), analysisModel: z.literal('gemini-3.5-flash-lite').optional() }),
  z.strictObject({ ...mutation, recordingId: z.string().uuid(), type: z.literal('PROBE_ANALYSIS') }),
  z.strictObject({ ...mutation, type: z.literal('RETRY_TRANSCRIPTION'), chunkId: z.string().uuid() }),
  z.strictObject({ ...mutation, type: z.literal('START_MOCK'), payload: z.strictObject({ profile: profileSchema }) }),
  z.strictObject({ ...mutation, type: z.literal('STOP_MOCK') }),
  z.strictObject({ ...mutation, type: z.literal('ADVANCE_MOCK') }),
  z.strictObject({ ...mutation, type: z.literal('FAIL_MOCK') }),
  z.strictObject({ ...mutation, type: z.literal('RECOVER_MOCK') }),
  z.strictObject({ ...mutation, type: z.literal('RESET_MOCK') }),
]);
export type Request = z.infer<typeof requestSchema>;
export const responseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ protocolVersion: z.literal(1), requestId: z.string().uuid(), ok: z.literal(true), snapshot: snapshotSchema }),
  z.strictObject({ protocolVersion: z.literal(1), requestId: z.string().uuid(), ok: z.literal(false), code: z.enum(['INVALID_MESSAGE', 'FORBIDDEN', 'MOCK_DISABLED', 'CONFLICT', 'INVALID_TRANSITION', 'STORAGE_FAILURE', 'CAPTURE_FAILURE', 'MIC_PERMISSION_REQUIRED']), message: z.string() }),
]);
export type Response = z.infer<typeof responseSchema>;

export function isTrustedPage(sender: Pick<chrome.runtime.MessageSender, 'id' | 'url'>, extensionId: string): boolean {
  if (sender.id !== extensionId || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'chrome-extension:' && url.hostname === extensionId
      && ['/src/popup/popup.html', '/src/settings/settings.html', '/src/session/session.html', '/src/microphone/microphone.html', '/src/library/library.html'].includes(url.pathname);
  } catch { return false; }
}
