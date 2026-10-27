import { z } from 'zod';

export const ANALYSIS_MODEL_IDS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'] as const;
export const analysisModelSchema = z.enum(ANALYSIS_MODEL_IDS);
export type AnalysisModel = z.infer<typeof analysisModelSchema>;
export const DEFAULT_ANALYSIS_MODEL: AnalysisModel = 'gemini-3.5-flash-lite';
// Official model cards checked 2026-10-17. Access still depends on the user's project.
export const analysisModels: Record<AnalysisModel, { label: string; inputTokens: number; outputTokens: number }> = {
  'gemini-3.5-flash-lite': { label: 'Econômico — Gemini 3.5 Flash-Lite', inputTokens: 1_048_576, outputTokens: 65_536 },
  'gemini-3.6-flash': { label: 'Equilibrado — Gemini 3.6 Flash', inputTokens: 1_048_576, outputTokens: 65_536 },
  'gemini-3.8-flash': { label: 'Avançado — Gemini 3.8 Flash', inputTokens: 1_048_576, outputTokens: 65_536 },
};
