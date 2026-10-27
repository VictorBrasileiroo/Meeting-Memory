import { expect, it } from 'vitest';
import { isTrustedManager, managementRequestSchema, managementResponseSchema } from '../src/messaging/management-protocol';
import { requestSchema } from '../src/messaging/protocol';

const id = '00000000-0000-4000-8000-000000000001';
it('somente a biblioteca da própria extensão pode executar limpeza', () => {
  expect(isTrustedManager({ id: 'x', url: 'chrome-extension://x/src/library/library.html' }, 'x')).toBe(true);
  for (const url of ['https://example.org/src/library/library.html', 'chrome-extension://x/src/session/session.html', 'chrome-extension://x/src/library/library.html/extra', 'chrome-extension://other/src/library/library.html']) expect(isTrustedManager({ id: 'x', url }, 'x')).toBe(false);
});
it('novos comandos exigem revisão, UUID e envelope próprio sem modificar comandos antigos', () => {
  const value = { protocolVersion: 1, requestId: id, target: 'background-management', type: 'DELETE_RECORDING', recordingId: id, expectedRevision: 1 };
  expect(managementRequestSchema.safeParse(value).success).toBe(true);
  expect(managementRequestSchema.safeParse({ ...value, expectedRevision: undefined }).success).toBe(false);
  expect(managementRequestSchema.safeParse({ ...value, recordingId: '*' }).success).toBe(false);
  expect(managementRequestSchema.safeParse({ ...value, apiKey: 'forbidden' }).success).toBe(false);
  expect(requestSchema.safeParse(value).success).toBe(false);
  expect(managementResponseSchema.safeParse({ protocolVersion: 1, requestId: id, ok: true, snapshot: {} }).success).toBe(false);
});
