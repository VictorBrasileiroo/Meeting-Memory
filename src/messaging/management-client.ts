import { managementRequestSchema, managementResponseSchema } from './management-protocol';
import { getSnapshot, isExtensionContext } from './client';
import type { ManagementAction } from '../storage/meeting-management';

export async function manageMeeting(recordingId: string, type: ManagementAction) {
  if (!isExtensionContext()) throw new Error('Abra o gerenciamento pela extensão instalada.');
  const snapshot = await getSnapshot();
  const request = managementRequestSchema.parse({ protocolVersion: 1, requestId: crypto.randomUUID(), target: 'background-management', type, recordingId, expectedRevision: snapshot.revision });
  let raw: unknown;
  try { raw = await chrome.runtime.sendMessage(request); }
  catch { throw new Error('A extensão não respondeu. Atualize a lista para conferir o resultado antes de repetir.'); }
  const response = managementResponseSchema.safeParse(raw);
  if (!response.success || response.data.requestId !== request.requestId || (response.data.ok && (response.data.result.recordingId !== recordingId || response.data.result.type !== type))) throw new Error('Resposta inesperada. Atualize a lista para conferir o resultado.');
  if (!response.data.ok) throw new Error(response.data.message);
  return response.data.result;
}
