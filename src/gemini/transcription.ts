import { GoogleGenAI } from '@google/genai';
import type { RemoteFile } from '../storage/recordings';
import type { JobFailure } from '../queue/job-policy';
import { TRANSCRIPTION_RATE_LIMIT } from '../queue/transcription-rate-limit';
import { transcriptionStructure } from './transcription-diagnostics';

export const TRANSCRIPTION_MODEL = TRANSCRIPTION_RATE_LIMIT.model;
export type ParsedTranscription = { rawText: string; annotations: unknown[]; speakers: string[]; interactionId: string | null };
export interface GeminiTranscriptionClient {
  uploadAudio(blob: Blob, mimeType: string, signal: AbortSignal): Promise<RemoteFile>;
  transcribe(file: RemoteFile, signal: AbortSignal): Promise<ParsedTranscription>;
  deleteFile(name: string, signal: AbortSignal): Promise<void>;
}

export function parseTranscription(value: unknown): ParsedTranscription {
  if (!value || typeof value !== 'object') throw new Error('Resposta da transcrição inválida.');
  const response = value as Record<string, unknown>;
  if (typeof response.output_text !== 'string') throw new Error('Resposta sem output_text.');
  const annotations: unknown[] = [];
  if (Array.isArray(response.steps)) for (const step of response.steps) {
    if (!step || typeof step !== 'object' || !Array.isArray((step as { content?: unknown }).content)) continue;
    for (const content of (step as { content: unknown[] }).content) {
      if (content && typeof content === 'object' && Array.isArray((content as { annotations?: unknown }).annotations))
        annotations.push(...(content as { annotations: unknown[] }).annotations);
    }
  }
  const speakers = [...new Set(annotations.flatMap((annotation) => annotation && typeof annotation === 'object' &&
    (annotation as { type?: unknown }).type === 'word_info' && typeof (annotation as { speaker?: unknown }).speaker === 'string'
    ? [(annotation as { speaker: string }).speaker] : []))];
  return { rawText: response.output_text, annotations, speakers, interactionId: typeof response.id === 'string' ? response.id : null };
}

export class GoogleGeminiTranscriptionClient implements GeminiTranscriptionClient {
  private client: GoogleGenAI;
  constructor(apiKey: string) { this.client = new GoogleGenAI({ apiKey }); }
  async uploadAudio(blob: Blob, mimeType: string, signal: AbortSignal): Promise<RemoteFile> {
    const file = await this.client.files.upload({ file: blob, config: { mimeType: mimeType.split(';')[0]?.trim() ?? mimeType, abortSignal: signal } });
    if (!file.name || !file.uri || !file.mimeType) throw new Error('Upload sem identificação remota completa.');
    return { name: file.name, uri: file.uri, mimeType: file.mimeType };
  }
  async transcribe(file: RemoteFile, signal: AbortSignal): Promise<ParsedTranscription> {
    const response = await this.client.interactions.create({ model: TRANSCRIPTION_MODEL,
      input: [{ type: 'audio', uri: file.uri, mime_type: file.mimeType }], store: false,
      generation_config: { transcription_config: { language_codes: ['pt-BR'], mode: { type: 'verbatim', diarization_mode: 'speaker' } } },
    }, { signal, retries: { strategy: 'none' } });
    if (__TRANSCRIPTION_DIAGNOSTICS__) console.info('MM_TRANSCRIPTION_STRUCTURE_DEV_ONLY', transcriptionStructure(response));
    return parseTranscription(response);
  }
  async deleteFile(name: string, signal: AbortSignal): Promise<void> { await this.client.files.delete({ name, config: { abortSignal: signal, httpOptions: { retryOptions: { attempts: 1 } } } }); }
}

export type GeminiStage = 'upload' | 'transcription' | 'cleanup' | 'analysis';
export function classifyGeminiError(error: unknown, stage: GeminiStage = 'transcription'): JobFailure {
  const candidate = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = typeof candidate.status === 'number' ? candidate.status : undefined;
  const payload = candidate.error && typeof candidate.error === 'object' ? candidate.error as Record<string, unknown> : {};
  const detail = payload.error && typeof payload.error === 'object' ? payload.error as Record<string, unknown> : payload;
  const code = detail.code === 'model_not_found' || detail.code === 'not_found' ? detail.code : null;
  const action = stage === 'upload' ? 'upload' : stage === 'cleanup' ? 'limpeza remota' : stage === 'analysis' ? 'geração de notas' : 'transcrição';
  const response = candidate.response && typeof candidate.response === 'object' ? candidate.response as { headers?: Headers } : undefined;
  const headers = candidate.headers instanceof Headers ? candidate.headers : response?.headers;
  const retryAfter = headers?.get?.('retry-after')?.trim();
  const seconds = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : null;
  const date = retryAfter && seconds === null ? Date.parse(retryAfter) - Date.now() : null;
  const retryAfterMs = Math.max(0, seconds ?? (Number.isFinite(date) ? date! : 0));
  if (status === 401 || status === 403) return { kind: 'USER_ACTION_REQUIRED', message: `Chave Gemini inválida ou sem acesso durante ${action} (HTTP ${status}). Revise em Configurações.` };
  if (status === 429) return { kind: 'RETRYABLE', message: `Cota Gemini temporariamente indisponível durante ${action} (HTTP 429). Se persistir, confira as cotas do projeto no AI Studio.`, retryAfterMs, rateLimited: true };
  if (status === 408 || (status !== undefined && status >= 500)) return { kind: 'RETRYABLE', message: `Gemini temporariamente indisponível durante ${action} (HTTP ${status}).`, retryAfterMs };
  if (status === 404) return { kind: 'USER_ACTION_REQUIRED', message: stage === 'upload'
    ? 'Files API retornou HTTP 404 durante o upload. Confira o acesso à API Gemini.'
    : `HTTP 404 durante ${action}${code ? ` (${code})` : ''}. ${code === 'model_not_found' ? 'Modelo indisponível para esta chave.' : 'Arquivo remoto não encontrado; confira o acesso à API.'}` };
  if (status !== undefined && status >= 400) return { kind: 'PERMANENT', message: `Gemini rejeitou ${action} (HTTP ${status}).` };
  if (candidate.name === 'AbortError') return { kind: 'RETRYABLE', message: 'Operação interrompida antes da conclusão.' };
  return { kind: 'RETRYABLE', message: 'Falha temporária na conexão com Gemini.' };
}
