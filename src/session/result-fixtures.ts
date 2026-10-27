// Development-only fixtures. This module is excluded from the production build.
import type { MeetingNotes, NotesOutput } from '../domain/notes';
import type { Recording, TranscriptChunk, Job } from '../storage/recordings';
import type { SessionData } from './session-data';

const createdAt = Date.parse('2026-10-16T17:30:00-03:00');
const quote = 'Vamos manter os dados no IndexedDB. Ana fica responsável por revisar a recuperação até sexta-feira.';
const reference = [{ chunkId: 'visual-part-1', quote }];
const item = (text: string, nature: 'established' | 'suggestion' | 'hypothesis' = 'established') => ({ text, nature, evidence: reference });
const recording: Recording = { id: 'visual-meeting', createdAt, startedAt: createdAt, endedAt: createdAt + 600000, profile: 'development', analysisModel: 'gemini-3.5-flash-lite', retention: 'keep-local', status: 'COMPLETED', revision: 1, durationMs: 600000, chunkCount: 3, completeness: 'COMPLETE', interruption: null };
const output: NotesOutput = {
  title: 'Uma base mais confiável para as próximas conversas',
  summary: [item('A equipe alinhou a evolução da memória de reuniões, com foco na preservação dos dados e em uma experiência de consulta mais clara. O armazenamento local permanece como base para retomar o trabalho com segurança.')],
  sections: [
    { kind: 'decisions', items: [item('Manter os dados no IndexedDB e preservar as reuniões já salvas durante a atualização da interface.')] },
    { kind: 'architectureDecisions', items: [item('Separar a apresentação dos resultados do processamento de áudio, mantendo os contratos existentes.')] },
    { kind: 'requestedChanges', items: [item('Organizar as notas como um documento contínuo, com acesso direto à transcrição e às partes da gravação.')] },
    { kind: 'risks', items: [item('Uma falha de conexão pode adiar o processamento. O material salvo precisa continuar acessível.')] },
    { kind: 'pending', items: [item('Avaliar a experiência de leitura em uma reunião longa antes da próxima entrega.'), item('Adicionar uma busca na biblioteca em uma etapa futura.', 'suggestion')] },
  ],
  tasks: [{ description: 'Revisar o fluxo de recuperação das reuniões.', owner: 'Ana', deadline: 'sexta-feira', status: 'defined', evidence: reference }],
};
const notes: MeetingNotes = { recordingId: recording.id, profile: recording.profile, analysisModel: 'gemini-3.5-flash-lite', schemaVersion: 1, promptVersion: 2, createdAt: createdAt + 900000, sourceKey: 'visual-only', output };
const transcripts: TranscriptChunk[] = [1, 2, 3].map(index => ({ id: `visual-part-${index}`, chunkId: `visual-part-${index}`, recordingId: recording.id, chunkIndex: index, model: 'gemini-3.5-transcribe', language: 'pt-BR', rawText: index === 1 ? `Vamos começar pela continuidade das reuniões já salvas.\n\n${quote}\n\nA transcrição deve permanecer disponível para consulta, mesmo quando o áudio não estiver mais no dispositivo.` : index === 2 ? 'A transcrição deve permanecer disponível para consulta, mesmo quando o áudio não estiver mais no dispositivo.\n\nPrecisamos separar a apresentação do processamento. A leitura das notas deve ser simples e permitir voltar à fonte sempre que necessário.' : 'Como próximo passo, vamos avaliar a experiência em reuniões longas. Talvez uma busca na biblioteca ajude, mas essa decisão fica para a próxima etapa.', annotations: [], speakers: [], createdAt, sourceMimeType: 'audio/webm', sourceSize: 1000, remoteFileName: `files/visual-${index}`, remoteDeleteStatus: 'DELETED', attempt: 1, metadata: { durationSource: 'clock', overlapMs: index > 1 ? 3000 : 0, interactionId: null } }));
const completed: SessionData = { recording, notes, transcripts, jobs: [], parts: transcripts.map(transcript => ({ id: transcript.chunkId, index: transcript.chunkIndex })) };
function clone(): SessionData { return structuredClone(completed); }
const small = clone(); small.notes!.output = { title: 'Alinhamento da semana', summary: [item('A revisão da recuperação ficou com Ana, para sexta-feira.')], sections: [], tasks: [] }; small.transcripts = [transcripts[0]!]; small.parts = [completed.parts[0]!];
const research = clone(); research.recording!.profile = 'research'; research.notes!.profile = 'research'; research.notes!.output = { title: 'Próximos passos da pesquisa sobre memória de trabalho', summary: [item('A discussão concentrou-se no desenho do estudo e nas condições necessárias para comparar os resultados. As hipóteses permanecem em investigação.')], sections: [
  { kind: 'guidance', items: [item('Registrar os critérios de seleção e as limitações do estudo.')] },
  { kind: 'methodologicalDecisions', items: [item('Comparar os resultados usando o mesmo protocolo de coleta.')] },
  { kind: 'hypotheses', items: [item('Intervalos de descanso podem influenciar o desempenho na tarefa.', 'hypothesis')] },
  { kind: 'experiments', items: [item('Realizar um piloto antes de ampliar a coleta.', 'suggestion')] },
  { kind: 'openQuestions', items: [item('Qual será o tamanho suficiente da amostra?')] },
], tasks: [] };
const long = clone(); long.notes!.output.title = 'Revisão técnica e planejamento de uma experiência de consulta duradoura';
for (const section of long.notes!.output.sections) section.items = Array.from({ length: 12 }, (_, index) => item(`${index + 1}. ${section.items[0]!.text}\n\nA revisão considera a continuidade do trabalho e a consulta posterior às decisões. As observações precisam preservar seu contexto, mesmo quando o documento reúne muitas partes.`));
long.notes!.output.summary[0]!.evidence[0]!.quote = `${quote}\n\n${'Uma citação extensa preserva quebras de linha e continua legível. '.repeat(20)}\n${'referencia_sem_espacos_'.repeat(35)}`;
long.transcripts[0]!.rawText += '\n\n' + long.notes!.output.summary[0]!.evidence[0]!.quote;
const legacy = clone(); legacy.notes = undefined; legacy.recording!.analysisModel = undefined;
const empty = clone(); empty.notes!.output = { title: null, summary: [], sections: [], tasks: [] };
const processing = clone(); processing.notes = undefined; processing.recording!.status = 'PROCESSING'; processing.transcripts = [transcripts[0]!];
const job: Job = { id: 'visual-job', kind: 'ANALYZE_RECORDING', recordingId: recording.id, chunkId: '', status: 'PROCESSING', attempts: 1, nextAttemptAt: 0, leaseOwner: 'visual', leaseExpiresAt: createdAt + 60000, generation: 1, lastError: null, errorKind: null };
const generating = clone(); generating.notes = undefined; generating.recording!.status = 'PROCESSING'; generating.jobs = [job];
const error = clone(); error.notes = undefined; error.recording!.status = 'ERROR'; error.jobs = [{ ...job, status: 'ERROR', errorKind: 'PERMANENT', lastError: 'HTTP 400 · A análise não foi concluída.', leaseOwner: null, leaseExpiresAt: null }];
const interrupted = clone(); interrupted.notes = undefined; interrupted.recording!.completeness = 'PARTIAL'; interrupted.recording!.interruption = 'Captura interrompida';
const credentials = clone(); credentials.notes = undefined; credentials.jobs = [{ ...job, status: 'WAITING_FOR_CREDENTIALS' }];
const rateLimit = clone(); rateLimit.notes = undefined; rateLimit.jobs = [{ ...job, status: 'ERROR', errorKind: 'RETRYABLE', lastError: 'HTTP 429 · limite da API', nextAttemptAt: Date.now() + 86400000 }];
const recovered = clone(); recovered.recording!.captureEndReason = 'TAB_CLOSED';
recovered.notes!.validation = { version: 1, omittedItems: 2, recoveredQuotes: 1, issues: [{ code: 'EVIDENCE_NOT_FOUND', count: 1 }, { code: 'UNSUPPORTED_OWNER', count: 1 }] };
export const resultFixtures: Record<string, SessionData> = { completed, small, research, development: completed, long, legacy, processing, generating, error, interrupted, empty, recovered, credentials, 'rate-limit': rateLimit, missing: { recording: undefined, notes: undefined, transcripts: [], jobs: [], parts: [] } };
