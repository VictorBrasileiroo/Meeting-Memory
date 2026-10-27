import { libraryReturnHref } from '../library/library-model';
import { useCallback, useEffect, useState } from 'react';
import { Library, Settings } from 'lucide-react';
import { Brand } from '../components/Brand';
import { Button } from '../components/ui/button';
import { useSnapshot } from '../components/useSnapshot';
import { openSettings, sendRequest } from '../messaging/client';
import { listRecordings, type Recording } from '../storage/recordings';
import { SessionResult } from './SessionResult';
import { type SessionData } from './session-data';
import { useSessionData } from './useSessionData';
import { MeetingSwitcher } from './MeetingSwitcher';
import { listMeetingChoices, meetingChoice, meetingLocation } from './meeting-choices';

function SavedResult({ recordingId, revision, activeStatus, recovery, onReady }: { recordingId: string; revision: number; activeStatus?: string; recovery: React.ReactNode; onReady?: () => void }) {
  const { data, problem } = useSessionData(recordingId);
  useEffect(() => { if (onReady && (data || problem)) { focusMeeting(); onReady(); } }, [data, problem, onReady]);
  return <>{problem && <p className="result-alert" role="alert">{problem}</p>}{data ? <SessionResult data={data} revision={revision} activeStatus={activeStatus} recovery={recovery} /> : !problem && <p className="empty-result" role="status">Carregando reunião…</p>}</>;
}

function focusMeeting() {
  const target = document.querySelector<HTMLElement>('#meeting-content h1') ?? document.getElementById('meeting-content');
  target?.focus({ preventScroll: true }); window.scrollTo(0, 0);
}

export function SessionApp() {
  const { snapshot, loading, error } = useSnapshot();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('recordingId'));
  const [actionProblem, setActionProblem] = useState('');
  const [fixtures, setFixtures] = useState<Record<string, SessionData>>();
  const [scenario, setScenario] = useState(() => new URLSearchParams(window.location.search).get('scenario') ?? 'completed');
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const loadChoices = useCallback(async () => {
    if (__FOUNDATION_MOCK__) return Object.entries(fixtures ?? {}).flatMap(([id, data]) => data.recording ? [meetingChoice(data.recording, data.notes, id)] : []);
    return listMeetingChoices();
  }, [fixtures]);
  useEffect(() => {
    if (__FOUNDATION_MOCK__) { void import('./result-fixtures').then(module => setFixtures(module.resultFixtures)); return; }
    let active = true;
    const refresh = () => void listRecordings().then(rows => { if (active) { setRecordings(rows); setListLoaded(true); } }).catch(() => { if (active) { setActionProblem('Não foi possível ler as reuniões salvas. Tente atualizar a página.'); setListLoaded(true); } });
    refresh(); const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    const sync = () => { const params = new URLSearchParams(window.location.search); setRecordingId(params.get('recordingId')); setScenario(params.get('scenario') ?? 'completed'); setFocusRequest(null); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  // Resolve a legacy URL once, then pin it. A new active session must not silently
  // replace the meeting being read, and an explicit unknown ID never falls back.
  useEffect(() => {
    if (__FOUNDATION_MOCK__ || recordingId !== null || loading || !listLoaded) return;
    const id = snapshot.recordingId ?? recordings[0]?.id;
    if (id) { const url = new URL(window.location.href); url.searchParams.set('recordingId', id); window.history.replaceState(null, '', url); setRecordingId(id); }
  }, [recordingId, loading, listLoaded, snapshot.recordingId, recordings]);
  useEffect(() => { if (__FOUNDATION_MOCK__ && focusRequest === scenario && fixtures?.[scenario]) { focusMeeting(); setFocusRequest(null); } }, [focusRequest, scenario, fixtures]);
  function chooseRecording(id: string) {
    if (id === (__FOUNDATION_MOCK__ ? scenario : recordingId)) return;
    window.history.pushState(null, '', meetingLocation(window.location.href, id, __FOUNDATION_MOCK__));
    if (__FOUNDATION_MOCK__) setScenario(id); else setRecordingId(id);
    setFocusRequest(id);
  }
  async function recover(type: 'RECOVER_CAPTURE' | 'RESET_CAPTURE') {
    try { await sendRequest({ protocolVersion: 1, requestId: crypto.randomUUID(), target: 'background', type, recordingId: snapshot.recordingId, expectedRevision: snapshot.revision }); setActionProblem(''); }
    catch (error) { setActionProblem(error instanceof Error ? error.message : 'Não foi possível atualizar a sessão.'); }
  }
  const activeSession = recordingId === snapshot.recordingId;
  const recovery = activeSession && snapshot.status === 'ERROR' ? <div className="recovery-actions"><p role="alert">{snapshot.failure?.message}</p><div className="flex flex-wrap gap-2">{snapshot.failure?.phase === 'processing' && snapshot.failure.recoverable && <><Button size="sm" onClick={() => void recover('RECOVER_CAPTURE')}>Tentar novamente</Button><Button size="sm" variant="secondary" onClick={openSettings}>Revisar configurações</Button></>}<Button size="sm" variant="link" onClick={() => void recover('RESET_CAPTURE')}>Arquivar sessão e iniciar outra</Button></div></div> : null;
  return <main className="results-app">
    <a className="skip-result" href="#meeting-content" onClick={event => { event.preventDefault(); document.getElementById('meeting-content')?.focus(); }}>Ir para o conteúdo</a>
    <header className="results-masthead"><div><Brand compact className="text-white [&_span_span]:text-muted-on-ink" /><div className="masthead-actions"><Button asChild variant="ghost" size="sm" className="text-muted-on-ink hover:bg-ink-raised hover:text-white"><a href={libraryReturnHref(window.location.search)} title="Reuniões e armazenamento"><Library aria-hidden="true" /><span className="max-[360px]:sr-only">Reuniões</span></a></Button><MeetingSwitcher currentId={__FOUNDATION_MOCK__ ? scenario : recordingId} loadChoices={loadChoices} hrefFor={id => meetingLocation(window.location.href, id, __FOUNDATION_MOCK__)} onChoose={chooseRecording} /><Button variant="ghost" size="sm" className="text-muted-on-ink hover:bg-ink-raised hover:text-white" onClick={openSettings}><Settings aria-hidden="true" /><span className="max-[719px]:sr-only">Configurações</span></Button></div></div></header>
    <div className="results-shell">
      {__FOUNDATION_MOCK__ && <p className="fixture-notice">Prévia de desenvolvimento · dados fictícios, sem envio à API.</p>}
      {error && <p className="result-alert" role="alert">{error}</p>}{actionProblem && <p className="result-alert" role="alert">{actionProblem}</p>}
      <div id="meeting-content" tabIndex={-1}>
        {__FOUNDATION_MOCK__ ? fixtures?.[scenario] ? <SessionResult key={scenario} data={fixtures[scenario]} /> : <p className="empty-result" role="status">Carregando prévia…</p> : recordingId !== null ? <SavedResult key={recordingId} recordingId={recordingId} revision={snapshot.revision} activeStatus={activeSession ? snapshot.status : undefined} recovery={recovery} onReady={focusRequest === recordingId ? () => setFocusRequest(null) : undefined} /> : <section className="empty-result"><h1 tabIndex={-1}>{loading || !listLoaded ? 'Carregando reuniões…' : 'Nenhuma reunião salva'}</h1><p>As notas e transcrições das suas gravações aparecerão aqui.</p></section>}
      </div>
    </div>
  </main>;
}
