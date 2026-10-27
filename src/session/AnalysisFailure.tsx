import { useState } from 'react';
import type { Job } from '../storage/recordings';
import { isTerminalJob } from '../queue/job-policy';
import { ANALYSIS_PROBE_MODEL, analysisProbeStages } from '../domain/analysis-probe';
import { Button } from '../components/ui/button';

export function AnalysisFailure({ job, onRetry, onRetryLite, onProbe }: { job: Job; onRetry: () => Promise<void>; onRetryLite?: () => Promise<void>; onProbe?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const terminal = job.status === 'ERROR' && isTerminalJob(job);
  async function retry(lite = false) {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await (lite && onRetryLite ? onRetryLite() : onRetry()); setNotice(lite ? 'Análise retomada com a transcrição salva e Gemini 3.5 Flash-Lite.' : 'Análise retomada com a transcrição salva e o modelo da análise.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível retomar a análise.'); }
    finally { setBusy(false); }
  }
  async function probe() {
    if (busy || !onProbe) return;
    setBusy(true); setNotice('');
    try { await onProbe(); setNotice('Teste técnico iniciado com Gemini 3.5 Flash-Lite. Até cinco chamadas com texto fictício, espaçadas por pelo menos 61 segundos. A reunião não será enviada.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível iniciar o teste técnico.'); }
    finally { setBusy(false); }
  }
  const diagnostic = { ...job.lastAnalysisDiagnostic, ...(job.analysisProbe ? { integrationProbe: job.analysisProbe } : {}) };
  return <>
    {terminal && <div className="analysis-recovery"><p>A transcrição está preservada. Reprocessar envia somente o texto salvo, com o mesmo modelo da análise (ou a escolha explícita abaixo), e pode gerar cobrança.</p>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => void retry()}>{busy ? 'Retomando análise…' : 'Reprocessar somente as notas'}</Button>
      {onRetryLite && <Button variant="ghost" disabled={busy} onClick={() => void retry(true)}>Reprocessar notas com Lite</Button>}</div>
      {onRetryLite && <p className="reading-footnote">Usar Gemini 3.5 Flash-Lite para gerar as notas desta sessão com a transcrição salva. Essa escolha fica registrada e pode gerar cobrança.</p>}
    </div>}
    {(job.lastAnalysisDiagnostic || job.analysisProbe || terminal) && <details className="analysis-diagnostics"><summary>Diagnóstico e teste de integração</summary>
    {(job.lastAnalysisDiagnostic || job.analysisProbe) && <details><summary>Diagnóstico seguro da Gemini</summary>
      <p className="field-help">Projeção de error.code e error.message. Trechos fora do vocabulário técnico são omitidos; a mensagem bruta não é armazenada. A causa pode continuar indeterminada.</p>
      <pre className="transcript-text">{JSON.stringify(diagnostic, null, 2)}</pre>
      {job.lastAnalysisDiagnostic?.genericMessage && !job.lastAnalysisDiagnostic.fieldViolations?.length && <p>A mensagem do provedor é genérica e não identifica o campo rejeitado. Repetir a mesma análise não esclarece a causa por si só.</p>}
      <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2)).then(() => setNotice('Diagnóstico seguro copiado.')).catch(() => setNotice('Não foi possível copiar o diagnóstico.'))}>Copiar diagnóstico seguro</Button>
    </details>}
    {job.analysisProbe && !job.analysisProbe.done && <p role="status">Teste técnico em andamento: {job.analysisProbe.results.length} de {analysisProbeStages(job.analysisProbe).length} etapas concluídas. Modelo do teste: {job.analysisProbe.model ?? 'teste antigo; será encerrado sem envio'}. Aguardando a próxima etapa; o teste para na primeira falha.</p>}
    {terminal && onProbe && <><p>Isolar a integração: até 5 chamadas com texto fictício, sem reenviar a reunião, usando {ANALYSIS_PROBE_MODEL}. Começa com texto livre, sem schema. Pode gerar cobrança e leva cerca de 4 minutos se todas as etapas forem aceitas. Para na primeira falha; 429 também encerra o teste. O teste não altera o modelo salvo da sessão nem gera notas.</p>
      <Button variant="secondary" disabled={busy} onClick={() => void probe()}>Testar integração com texto fictício (Lite)</Button></>}
    {terminal && !job.lastAnalysisDiagnostic && <p>O detalhe do erro anterior não foi preservado. Uma nova tentativa de análise poderá coletar o diagnóstico seguro.</p>}
    </details>}
    <p role="status">{notice}</p>
  </>;
}
