import { GoogleGenAI } from '@google/genai';
import { ZodError } from 'zod';
import { notesJsonSchema, notesOutputSchema } from '../domain/notes';
import { recoverNotesOutput, type AnalyzedNotes } from '../domain/notes-recovery';
import type { Profile } from '../domain/profiles';
import { analysisModelSchema, type AnalysisModel } from '../domain/analysis-models';
import { ANALYSIS_PROBE_INPUT, type AnalysisProbeStage } from '../domain/analysis-probe';
import type { Chunk, Recording, TranscriptChunk } from '../storage/recordings';
import { classifyGeminiError } from './transcription';
import type { JobFailure } from '../queue/job-policy';
import { AnalysisError, prepareAnalysis, ANALYSIS_OUTPUT_TOKENS } from '../domain/analysis-input';
import { analysisDiagnostic } from '../domain/analysis-diagnostic';

export interface GeminiAnalysisClient {
  analyze(recording: Recording, chunks: readonly Chunk[], transcripts: readonly TranscriptChunk[], signal: AbortSignal): Promise<AnalyzedNotes>;
}
export class GoogleGeminiAnalysisClient implements GeminiAnalysisClient {
  private client: GoogleGenAI;
  constructor(apiKey: string) { this.client = new GoogleGenAI({ apiKey }); }
  // Explicit diagnostic only. Never receives meeting data or changes the model.
  async probe(model: AnalysisModel, profile: Profile, stage: AnalysisProbeStage, signal: AbortSignal): Promise<void> {
    if (stage === 'TEXT_ONLY') {
      await this.client.interactions.create({ model: analysisModelSchema.parse(model), input: 'Responda apenas OK.', store: false }, { signal, retries: { strategy: 'none' } });
      return;
    }
    const schema = stage === 'MINIMAL_SCHEMA' ? { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }
      : stage === 'NOTES_SCHEMA' ? notesJsonSchema(profile) : undefined;
    await this.client.interactions.create({ model: analysisModelSchema.parse(model), input: ANALYSIS_PROBE_INPUT,
      system_instruction: 'Responda ao teste técnico com JSON. Não use ferramentas ou dados externos.', store: false,
      response_format: { type: 'text', mime_type: 'application/json', ...(schema ? { schema } : {}) },
      ...(stage !== 'JSON_ONLY' ? { generation_config: { max_output_tokens: ANALYSIS_OUTPUT_TOKENS } } : {}),
    }, { signal, retries: { strategy: 'none' } });
  }
  async analyze(recording: Recording, chunks: readonly Chunk[], transcripts: readonly TranscriptChunk[], signal: AbortSignal): Promise<AnalyzedNotes> {
    const prepared = prepareAnalysis(recording, chunks, transcripts);
    const response = await this.client.interactions.create({
      model: prepared.model, system_instruction: prepared.systemInstruction, input: prepared.input, store: false,
      // The full schema was rejected in the user's isolated Lite probe. JSON
      // mode was accepted; keep the contract in instructions and validate locally.
      response_format: { type: 'text', mime_type: 'application/json' },
      generation_config: { max_output_tokens: ANALYSIS_OUTPUT_TOKENS },
    }, { signal, retries: { strategy: 'none' } });
    if (response.status !== 'completed' || !response.output_text) throw new AnalysisError('INVALID_OUTPUT', 'INCOMPLETE');
    let value: unknown;
    try { value = JSON.parse(response.output_text); } catch { throw new AnalysisError('INVALID_OUTPUT', 'JSON'); }
    try {
      const output = notesOutputSchema(recording.profile).parse(value);
      for (const item of [...output.summary, ...output.sections.flatMap(section => section.items), ...output.tasks]) {
        for (const ref of item.evidence) ref.chunkId = prepared.sourceIds.get(ref.chunkId) ?? ref.chunkId;
      }
      return recoverNotesOutput(output, recording.profile, transcripts);
    } catch (error) {
      if (error instanceof ZodError) throw new AnalysisError('INVALID_OUTPUT', 'SCHEMA');
      throw error; // Do not mislabel internal failures as evidence failures.
    }
  }
}
export function classifyAnalysisError(error: unknown): JobFailure {
  if (error instanceof AnalysisError) {
    if (error.code === 'CONTEXT_LIMIT') return { kind: 'USER_ACTION_REQUIRED', message: 'A transcrição excede o orçamento seguro de contexto. Nenhum texto foi truncado. Copie a transcrição; a análise integral exige suporte a reuniões maiores.' };
    if (error.code === 'INCOMPLETE') return { kind: 'USER_ACTION_REQUIRED', message: 'A gravação ou transcrição está incompleta. As notas finais não foram geradas; consulte a fonte preservada.' };
    if (error.diagnostic) return { kind: 'USER_ACTION_REQUIRED', message: `A resposta de notas não pôde ser validada (${error.diagnostic}). A transcrição foi preservada. Você pode tentar gerar somente as notas novamente.` };
    return { kind: 'RETRYABLE', message: `A resposta de notas veio incompleta, com JSON, schema ou evidência inválida${error.diagnostic ? ` (${error.diagnostic})` : ''}. A transcrição foi preservada.` };
  }
  const failure = classifyGeminiError(error, 'analysis');
  const diagnostic = analysisDiagnostic(error);
  if (diagnostic?.httpStatus === 400) return { kind: 'PERMANENT', message: 'A Gemini rejeitou a requisição de notas (HTTP 400). Consulte o diagnóstico seguro na sessão. Isso não confirma falha da chave. A transcrição foi preservada.', analysisDiagnostic: diagnostic };
  if ((error as { status?: number } | null)?.status === 404) return { kind: 'USER_ACTION_REQUIRED', message: 'O modelo de notas selecionado está indisponível (HTTP 404). Confira o acesso no AI Studio. Não houve troca de modelo.' };
  return { ...failure, ...(diagnostic ? { analysisDiagnostic: diagnostic } : {}), ...(failure.rateLimited ? { retryAfterMs: Math.max(61_000, failure.retryAfterMs ?? 0) } : {}) };
}
