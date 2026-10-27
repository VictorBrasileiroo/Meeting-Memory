import type { AnalysisDiagnostic } from './analysis-diagnostic';
import type { AnalysisModel } from './analysis-models';

const LEGACY_PROBE_STAGES = ['JSON_ONLY', 'OUTPUT_LIMIT', 'MINIMAL_SCHEMA', 'NOTES_SCHEMA'] as const;
export const ANALYSIS_PROBE_STAGES = ['TEXT_ONLY', ...LEGACY_PROBE_STAGES] as const;
export const ANALYSIS_PROBE_MODEL = 'gemini-3.5-flash-lite' satisfies AnalysisModel;
export type AnalysisProbeStage = typeof ANALYSIS_PROBE_STAGES[number];
export type AnalysisProbeStep = { stage: AnalysisProbeStage; outcome: 'ACCEPTED' | 'FAILED'; diagnostic?: AnalysisDiagnostic; message?: string };
export type AnalysisProbeRun = { version?: 2; model?: AnalysisModel; nextStage: number; done: boolean; results: AnalysisProbeStep[] };
// Saved v1 indices must keep their original meaning after an extension update.
export function analysisProbeStages(run?: AnalysisProbeRun) { return run?.version === 2 ? ANALYSIS_PROBE_STAGES : LEGACY_PROBE_STAGES; }
export const ANALYSIS_PROBE_SPACING_MS = 61_000;
export const ANALYSIS_PROBE_INPUT = 'Teste técnico com dados fictícios: uma transação agrupa operações. Retorne somente JSON conforme o schema, se fornecido. Sem schema, retorne {"ok":true}. Não crie decisões ou tarefas.';
