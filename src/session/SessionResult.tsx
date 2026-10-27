import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, AudioLines, CalendarDays, Clock, Check, CircleAlert, FileText, Headphones, Settings, Text } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { profiles } from '../domain/profiles';
import { openSettings, sendRequest } from '../messaging/client';
import { canClaimJob } from '../queue/job-policy';
import { getChunk, type Job } from '../storage/recordings';
import { AnalysisFailure } from './AnalysisFailure';
import { AudioParts } from './AudioParts';
import { NotesActions, NotesContent, type SourceReference } from './NotesContent';
import { OriginalTranscript } from './OriginalTranscript';
import { meetingTitle, sessionPhase, type SessionData } from './session-data';
import { readSessionLocation, type SessionTab } from './session-location';

function PartRetry({ job, revision, recordingId }: { job: Job; revision: number; recordingId: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function retry() {
    setBusy(true);
    try {
      const chunk = await getChunk(job.chunkId);
      if (!chunk?.blob.size) throw new Error('O áudio desta parte não está disponível para repetir a transcrição.');
      await sendRequest({ protocolVersion: 1, requestId: crypto.randomUUID(), target: 'background', type: 'RETRY_TRANSCRIPTION', recordingId, expectedRevision: revision, chunkId: job.chunkId });
      if (__CHUNK_TEST__) await chrome.runtime.sendMessage({ target: 'offscreen-capture', type: 'ENABLE_TEST_TRANSCRIPTION' });
      setNotice('Nova tentativa solicitada para esta parte.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível repetir esta parte.'); }
    finally { setBusy(false); }
  }
  return <><Button size="sm" variant="secondary" disabled={busy} onClick={() => void retry()}>Repetir só esta parte (pode gerar cobrança)</Button><p role="status">{notice}</p></>;
}

function ProcessingDetails({ data, revision, activeStatus }: { data: SessionData; revision: number; activeStatus?: string }) {
  const { recording, jobs, parts, transcripts } = data;
  const analysis = jobs.find(job => job.kind === 'ANALYZE_RECORDING');
  const transcribed = new Set(transcripts.map(transcript => transcript.chunkId));
  const jobsByPart = new Map(jobs.filter(job => job.kind === 'TRANSCRIBE_CHUNK').map(job => [job.chunkId, job]));
  const request = async (type: 'RETRY_ANALYSIS' | 'PROBE_ANALYSIS', lite = false) => { if (recording) await sendRequest({ protocolVersion: 1, requestId: crypto.randomUUID(), target: 'background', type, recordingId: recording.id, expectedRevision: revision, ...(lite ? { analysisModel: 'gemini-3.5-flash-lite' as const } : {}) }); };
  return <details className="processing-details"><summary>Detalhes do processamento<span>{transcripts.length} de {parts.length} {parts.length === 1 ? 'parte transcrita' : 'partes transcritas'}</span></summary>
    <div className="processing-body">
      {recording?.analysisModel && <p>Modelo desta sessão: {recording.analysisModel}</p>}
      {analysis?.analysisModelOverride && <p>Modelo escolhido para reprocessar as notas: {analysis.analysisModelOverride}</p>}
      <ol className="progress-list">{parts.map(part => { const job = jobsByPart.get(part.id); return <li key={part.id}><strong>Parte {part.index}</strong><span>{transcribed.has(part.id) ? 'Transcrita' : job?.status === 'PROCESSING' ? 'Transcrevendo…' : job?.status === 'WAITING_FOR_CREDENTIALS' ? 'Aguardando credenciais' : job?.status === 'ERROR' ? job.lastError ?? 'Falha na transcrição' : 'Aguardando'}</span>{job?.status === 'ERROR' && (job.remoteFile || jobs.some(cleanup => cleanup.id === `delete-failed:${part.id}`)) && <span>Upload confirmado</span>}{activeStatus === 'ERROR' && job?.status === 'ERROR' && job.lastError?.includes('HTTP 404') && recording && <PartRetry job={job} revision={revision} recordingId={recording.id} />}</li>; })}</ol>
      {analysis?.lastError && <p>{analysis.lastError}{canClaimJob(analysis, Number.MAX_SAFE_INTEGER) ? ' Uma nova tentativa será feita automaticamente.' : ''}</p>}
      {analysis && <AnalysisFailure job={analysis} onRetry={() => request('RETRY_ANALYSIS')} onRetryLite={() => request('RETRY_ANALYSIS', true)} onProbe={() => request('PROBE_ANALYSIS')} />}
      {__CHUNK_TEST__ && jobs.some(job => job.kind === 'TRANSCRIBE_CHUNK' && canClaimJob(job, Date.now())) && <Button variant="secondary" onClick={() => void chrome.runtime.sendMessage({ target: 'offscreen-capture', type: 'ENABLE_TEST_TRANSCRIPTION' })}>Transcrever uma parte de teste</Button>}
    </div>
  </details>;
}

export function SessionResult({ data, revision = 0, activeStatus, recovery }: { data: SessionData; revision?: number; activeStatus?: string; recovery?: ReactNode }) {
  const [location, setLocation] = useState(() => readSessionLocation(typeof window === 'undefined' ? '' : window.location.hash));
  const [source, setSource] = useState<{ ref: SourceReference; returnId: string }>();
  const [returnFocus, setReturnFocus] = useState<string>();
  const [markedParts, setMarkedParts] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setLocation(readSessionLocation(window.location.hash));
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  useEffect(() => {
    // Radix lazily mounts the newly selected panel. Wait for that commit before
    // resolving the source or restoring an evidence disclosure's focus.
    const frame = requestAnimationFrame(() => {
      if (location.tab === 'notes' && returnFocus) {
        const details = document.getElementById(returnFocus);
        if (details instanceof HTMLDetailsElement) { details.open = true; details.querySelector('summary')?.focus(); }
        setReturnFocus(undefined);
      } else if (location.target) {
        const target = document.getElementById(location.target) ?? document.getElementById('transcript-heading');
        target?.focus(); target?.scrollIntoView({ block: location.tab === 'notes' ? 'start' : 'center' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location, returnFocus]);
  const { recording, notes, transcripts } = data;
  if (!recording) return <section className="empty-result"><CircleAlert aria-hidden="true" /><h1 tabIndex={-1}>Reunião não encontrada</h1><p>Este ID não corresponde a uma reunião salva. Use Trocar reunião para escolher outra.</p></section>;
  const phase = sessionPhase(data);
  function navigate(tab: SessionTab, hash = `#${tab}`) {
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setLocation(readSessionLocation(hash));
  }
  const highlightedParts = location.tab === 'transcript' && location.target?.startsWith('source-') ? data.parts.filter(part => `source-${part.id}` === location.target).map(part => part.id) : markedParts;
  const sourceMissing = location.target?.startsWith('source-') && !transcripts.some(transcript => `source-${transcript.chunkId}` === location.target);
  return <>
    <header className="meeting-heading">
      
      <h1 tabIndex={-1}>{meetingTitle(recording, notes)}</h1>
      <div className="meeting-meta"><span><CalendarDays aria-hidden="true" /><time dateTime={new Date(recording.createdAt).toISOString()}>{new Date(recording.createdAt).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</time></span>{Number.isFinite(recording.durationMs) && recording.durationMs > 0 && <span><Clock aria-hidden="true" />{Math.floor(recording.durationMs / 60000)} min {Math.floor(recording.durationMs / 1000) % 60} s</span>}<span className="profile-label">{profiles[recording.profile].label}</span><span className={`phase-label phase-${phase.tone}`} role="status" aria-live="polite">{phase.tone === 'success' ? <Check aria-hidden="true" /> : phase.tone === 'error' || phase.tone === 'warning' ? <CircleAlert aria-hidden="true" /> : <AudioLines aria-hidden="true" />}{phase.label}</span></div>
      {data.parts.length > 0 && <div className="recording-tape"><h2>Gravação em {data.parts.length} {data.parts.length === 1 ? 'parte' : 'partes'}</h2><div className="tape-parts" role="img" aria-label={`Gravação em ${data.parts.length} partes${highlightedParts.length ? `; fonte aberta nas partes ${data.parts.filter(part => highlightedParts.includes(part.id)).map(part => part.index).join(', ')}` : '; sem duração medida por parte'}`}>{data.parts.map(part => <div key={part.id} className={`tape-part ${highlightedParts.includes(part.id) ? 'tape-part-active' : highlightedParts.length ? 'tape-part-dim' : ''}`}><span className="tape-segment" /><span>Parte {part.index}</span></div>)}</div></div>}
    </header>
    <div className="result-paper">
      {recording.captureEndReason === 'TAB_CLOSED' && <p className="capture-end-notice" role="status">Gravação encerrada automaticamente porque a aba foi fechada.</p>}
      {(((phase.tone === 'warning' || phase.tone === 'error') && (location.tab !== 'notes' || notes)) || recovery) && <aside className={`processing-notice phase-${phase.tone}`}>{(location.tab !== 'notes' || notes) && <p>{phase.description}</p>}{phase.label === 'Configure sua chave Gemini' && <Button size="sm" variant="secondary" onClick={openSettings}><Settings aria-hidden="true" />Configurar chave</Button>}{recovery}</aside>}
      <Tabs value={location.tab} onValueChange={value => navigate(value as SessionTab)} className="result-tabs gap-0">
        <div className="result-controls">
          <TabsList aria-label="Conteúdo da reunião" className="result-tab-list gap-1 border-b-0 min-[720px]:gap-6"><TabsTrigger className="max-[360px]:gap-1 max-[360px]:px-0 max-[360px]:text-xs" value="notes"><FileText aria-hidden="true" />Notas</TabsTrigger><TabsTrigger className="max-[360px]:gap-1 max-[360px]:px-0 max-[360px]:text-xs" value="transcript"><Text aria-hidden="true" />Transcrição</TabsTrigger><TabsTrigger className="max-[360px]:gap-1 max-[360px]:px-0 max-[360px]:text-xs" value="audio"><Headphones aria-hidden="true" />Áudio</TabsTrigger></TabsList>
          {location.tab === 'notes' && notes && <NotesActions notes={notes} />}
        </div>
        <TabsContent value="notes" className="result-panel">
          {notes ? <NotesContent notes={notes} showTitle={false} showActions={false} parts={data.parts} onEvidenceChange={setMarkedParts} onSource={(ref, returnId) => { setSource({ ref, returnId }); navigate('transcript', `#source-${encodeURIComponent(ref.chunkId)}`); }} /> : <section className="reading-column empty-reading"><FileText aria-hidden="true" className="size-7 text-muted-foreground" /><h2>{phase.label}</h2><p>{phase.description}</p><div className="flex flex-wrap gap-2">{phase.label === 'Configure sua chave Gemini' && <Button variant="secondary" onClick={openSettings}><Settings aria-hidden="true" />Configurar chave</Button>}<Button variant="secondary" onClick={() => navigate('transcript')}><Text aria-hidden="true" />Ver transcrição</Button><Button variant="ghost" onClick={() => navigate('audio')}><Headphones aria-hidden="true" />Ouvir gravação</Button></div></section>}
        </TabsContent>
        <TabsContent value="transcript" className="result-panel">
          {(source || location.target?.startsWith('source-')) && <aside className="source-context reading-column"><div className="flex flex-wrap items-center justify-between gap-2"><strong>Fonte da nota</strong><Button size="sm" variant="link" onClick={() => { setReturnFocus(source?.returnId); setSource(undefined); navigate('notes'); }}><ArrowLeft aria-hidden="true" />Voltar à nota</Button></div>{source && <blockquote>{source.ref.quote}</blockquote>}<p>{sourceMissing ? 'A parte indicada não está disponível nesta sessão.' : 'A referência identifica a parte, sem posição exata ou marcação de tempo. Consulte o texto integral abaixo.'}</p></aside>}
          <OriginalTranscript transcripts={transcripts} expanded />
        </TabsContent>
        <TabsContent value="audio" className="result-panel"><AudioParts recordingId={recording.id} revision={recording.revision} parts={data.parts} retention={recording.retention} /></TabsContent>
      </Tabs>
      <ProcessingDetails data={data} revision={revision} activeStatus={activeStatus} />
    </div>
  </>;
}
