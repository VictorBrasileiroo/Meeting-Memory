import { useEffect, useState } from 'react';
import { useSnapshot } from '../components/useSnapshot';
import { PROFILE_IDS, profiles, type Profile } from '../domain/profiles';
import { openMicrophonePermission, openSession, openSettings, sendRequest } from '../messaging/client';
import type { Request } from '../messaging/protocol';
import { Check, CircleAlert, CircleCheck, Code2, FlaskConical, GraduationCap, LoaderCircle, Lock, Users, AppWindow, Mic, Circle, Square, Settings2, Library } from 'lucide-react';
import { Brand } from '../components/Brand';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AudioWaveform } from './AudioWaveform';
import { NativeSelect } from '../components/ui/native-select';

function formatElapsed(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const parts = seconds >= 3600 ? [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    : [Math.floor(seconds / 60), seconds % 60];
  return parts
    .map((part) => part.toString().padStart(2, '0')).join(':');
}
const statusLabels = {
  IDLE: 'Pronto para gravar', STARTING: 'Preparando simulação', RECORDING: 'Gravando · simulação',
  STOPPING: 'Finalizando simulação', PROCESSING: 'Processando reunião', COMPLETED: 'Notas prontas', ERROR: 'Não foi possível concluir',
} as const;
const badgeLabels = {
  IDLE: 'Pronto', STARTING: 'Preparando', RECORDING: 'Gravando', STOPPING: 'Finalizando',
  PROCESSING: 'Processando', COMPLETED: 'Pronto', ERROR: 'Erro',
} as const;

const profileIcons = { general: Users, research: FlaskConical, development: Code2, class: GraduationCap };
type SourceLevels = { tab: number; microphone: number };
function AudioSources({ simulated, recording, levels }: { simulated: boolean; recording: boolean; levels: SourceLevels | null }) {
  return <section className="popup-sources" aria-labelledby="audio-sources-label" aria-describedby="foundation-note">
    <h2 id="audio-sources-label">Fontes de áudio</h2>
    <div className="audio-source-list">
      {(['tab', 'microphone'] as const).map((source) => <div className="audio-source-row" key={source}>
        {source === 'tab' ? <AppWindow aria-hidden="true" size={19} strokeWidth={1.7} /> : <Mic aria-hidden="true" size={19} strokeWidth={1.7} />}
        <div className="audio-source-text"><strong>{source === 'tab' ? 'Áudio da aba' : 'Microfone'}</strong><span>{source === 'tab' ? 'Aba atual' : 'Padrão do sistema'}</span></div>
        <span className={`audio-level${simulated ? ' audio-level-simulated' : ''}${recording && levels ? ' audio-level-live' : ''}`} role="img" aria-label={simulated ? 'Barras ilustrativas da simulação, sem medição de áudio' : recording ? 'Nível visual aproximado do áudio' : 'Sem medição de áudio'}>
          {[0, 1, 2, 3, 4].map((bar) => <i key={bar} className={recording && levels && levels[source] > bar / 5 ? 'audio-level-active' : undefined} />)}
        </span>
      </div>)}
    </div>
  </section>;
}
export function PopupApp() {
  const { snapshot, setSnapshot, loading, error, setError, refresh } = useSnapshot();
  const [profile, setProfile] = useState<Profile>('general');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [levels, setLevels] = useState<SourceLevels | null>(null);
  const mock = __FOUNDATION_MOCK__;
  useEffect(() => {
    if (snapshot.status !== 'RECORDING') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [snapshot.status]);
  useEffect(() => {
    if (mock || snapshot.status !== 'RECORDING' || !snapshot.recordingId || typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    let active = true;
    let reading = false;
    const recordingId = snapshot.recordingId;
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const reply = await chrome.runtime.sendMessage({ target: 'offscreen-capture', type: 'LEVELS', recordingId }) as { ok?: boolean; levels?: { recordingId: string; tab: number; microphone: number } | null };
        if (active && reply?.ok && reply.levels?.recordingId === recordingId) setLevels({ tab: reply.levels.tab, microphone: reply.levels.microphone });
      } catch { if (active) setLevels(null); }
      finally { reading = false; }
    };
    void read();
    const timer = setInterval(() => void read(), 180);
    return () => { active = false; clearInterval(timer); };
  }, [mock, snapshot.status, snapshot.recordingId]);
  useEffect(() => {
    if (!mock || snapshot.status !== 'RECORDING') return;
    let sample = 0;
    const timer = setInterval(() => { sample++; setLevels({ tab: (Math.sin(sample * .7) + 1) * .35, microphone: (Math.sin(sample * .43) + 1) * .25 }); }, 180);
    return () => clearInterval(timer);
  }, [mock, snapshot.status]);
  async function command(type: Exclude<Request['type'], 'GET_SNAPSHOT'>) {
    setBusy(true); setError(null);
    const base = { protocolVersion: 1 as const, requestId: crypto.randomUUID(), target: 'background' as const,
      expectedRevision: snapshot.revision, recordingId: snapshot.recordingId };
    const request: Request = type === 'START_MOCK' || type === 'START_CAPTURE' ? { ...base, type, payload: { profile } } : { ...base, type } as Request;
    try { setSnapshot(await sendRequest(request)); setNow(Date.now()); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Não foi possível atualizar a simulação.'); }
    finally { setBusy(false); }
  }
  async function startCapture() {
    if (mock) { await command('START_MOCK'); return; }
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permission.state !== 'granted') { openMicrophonePermission(); return; }
    } catch { openMicrophonePermission(); return; }
    await command('START_CAPTURE');
  }
  const disabled = loading || busy;
  const canRecover = snapshot.status === 'ERROR' && snapshot.failure?.phase === 'processing'
    && snapshot.failure.recoverable && snapshot.failure.hasRecoverableData;
  const showSources = ['IDLE', 'STARTING', 'STOPPING'].includes(snapshot.status);
  const elapsed = snapshot.startedAt === null ? 0 : (snapshot.endedAt ?? now) - snapshot.startedAt;
  return <main className={`popup-shell ${snapshot.status === 'RECORDING' ? 'popup-recording' : ''}`}>

    <header className="app-header">
      <div className="popup-brand"><Brand compact heading className={snapshot.status === 'RECORDING' ? 'text-white [&_span_span]:text-muted-on-ink' : undefined} /></div>
      <Badge variant={['IDLE', 'COMPLETED'].includes(snapshot.status) ? 'success' : ['RECORDING', 'ERROR'].includes(snapshot.status) ? 'destructive' : 'default'} className={`popup-badge popup-badge-${snapshot.status.toLowerCase()} ${snapshot.status === 'RECORDING' ? 'bg-ink-raised text-recording' : ''}`} role="status" aria-label={loading ? 'Lendo estado local' : mock ? statusLabels[snapshot.status] : snapshot.status === 'COMPLETED' ? 'Gravação concluída' : snapshot.status === 'STARTING' ? 'Preparando gravação' : snapshot.status === 'STOPPING' ? 'Finalizando gravação' : badgeLabels[snapshot.status]}><span aria-hidden="true" />{loading ? 'Lendo' : badgeLabels[snapshot.status]}</Badge>
      <Button asChild variant="ghost" size="icon" className={`size-10 shrink-0 ${snapshot.status === 'RECORDING' ? 'text-muted-on-ink hover:bg-ink-raised hover:text-white' : ''}`}><a href="../library/library.html" target="_blank" rel="noreferrer" aria-label="Reuniões e armazenamento" title="Reuniões e armazenamento"><Library aria-hidden="true" /></a></Button>
      <Button variant="ghost" size="icon" className={`size-10 shrink-0 ${snapshot.status === 'RECORDING' ? 'text-muted-on-ink hover:bg-ink-raised hover:text-white' : ''}`} title="Configurações" aria-label="Configurações" onClick={openSettings}><Settings2 aria-hidden="true" /></Button></header>
    {loading ? <p role="status">Lendo estado local…</p> : <>
      {snapshot.status === 'IDLE' && <>
        <h2 className="popup-title">Que conversa vai ser?</h2>
        <div className="sr-only"><label htmlFor="profile">Perfil</label><NativeSelect id="profile" tabIndex={-1} aria-hidden="true" value={profile} disabled={disabled} onChange={event => setProfile(event.target.value as Profile)}>{PROFILE_IDS.map(id => <option key={id} value={id}>{profiles[id].label}</option>)}</NativeSelect></div>
        <fieldset className="mb-5 border-0 p-0" disabled={disabled}><legend className="mb-2 text-[13px] font-medium">Perfil</legend><div className="grid grid-cols-2 gap-2">{PROFILE_IDS.map(id => { const Icon = profileIcons[id]; return <label key={id} className="profile-choice relative flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2 text-sm font-medium has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring"><input className="sr-only" type="radio" name="profile-choice" value={id} checked={profile === id} onChange={() => setProfile(id)} /><Icon aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{id === 'general' ? 'Reunião geral' : profiles[id].label}</span></label>; })}</div></fieldset>
      </>}
      {showSources && <AudioSources simulated={mock && snapshot.status === 'RECORDING'} recording={!mock && snapshot.status === 'RECORDING'} levels={levels} />}
      {snapshot.status === 'IDLE' ? <>
        <Button className="w-full popup-action popup-start" aria-describedby="foundation-note" disabled={disabled} onClick={() => void startCapture()}><Circle aria-hidden="true" />Iniciar gravação</Button>
      </> : <section className={`recording-panel ${snapshot.status === 'ERROR' ? 'popup-error-actions' : ''}`}>
        {!showSources && snapshot.status !== 'RECORDING' && <h2 className={`popup-status popup-status-${snapshot.status.toLowerCase()}`}>{mock ? statusLabels[snapshot.status] : snapshot.status === 'COMPLETED' ? 'Notas prontas' : snapshot.status === 'PROCESSING' ? 'Preparando suas notas' : 'Não foi possível concluir'}</h2>}
        {snapshot.captureEndReason === 'TAB_CLOSED' && <p className="text-sm text-muted-foreground" role="status">Gravação encerrada automaticamente porque a aba foi fechada.</p>}
        {!mock && ['STARTING', 'STOPPING'].includes(snapshot.status) && <p>{snapshot.status === 'STARTING' ? 'Preparando gravação…' : 'Finalizando gravação…'}</p>}
        
        {snapshot.status === 'RECORDING' && <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold text-recording"><span className="recording-dot" />Gravando</span><span className="flex items-center gap-2 rounded-full bg-ink-raised px-3 py-1.5 text-[13px] text-muted-on-ink"><Lock aria-hidden="true" className="size-3" />{profiles[snapshot.profile].label}</span></div>
          <div className="recording-clock" aria-label={mock ? 'Tempo simulado' : 'Tempo de gravação'}>{formatElapsed(elapsed)}</div>
          <AudioWaveform levels={levels} simulated={mock} />
          <div className="mt-4 flex flex-wrap gap-5 text-[13px] text-muted-on-ink"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-audio-tab" aria-hidden="true" />Áudio da aba</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-audio-mic" aria-hidden="true" />Microfone</span></div>
          {!mock && <p className="my-6 text-[13px] text-muted-on-ink">Pode fechar este popup, a gravação continua.</p>}
          <Button variant="secondary" className="mt-6 w-full popup-action popup-stop" aria-describedby="foundation-note" disabled={disabled} onClick={() => void command(mock ? 'STOP_MOCK' : 'STOP_CAPTURE')}><Square aria-hidden="true" />{mock ? 'Parar gravação' : 'Finalizar gravação'}</Button>
        </>}
        {['STARTING', 'STOPPING'].includes(snapshot.status) && <Button className="w-full" disabled>{mock ? 'Aguardando avanço da simulação' : snapshot.status === 'STARTING' ? 'Preparando gravação' : 'Finalizando gravação'}</Button>}
        {snapshot.status === 'PROCESSING' && <>
          <p className="mb-6 text-sm text-muted-foreground">Pode fechar este popup, o processamento continua.</p>
          {snapshot.processingStage && <ol className="processing-steps">{['Áudio transcrito', 'Organizando as notas', 'Notas prontas'].map((label, index) => { const active = snapshot.processingStage === 'transcribing' ? 0 : 1; const Icon = index < active ? Check : index === active ? LoaderCircle : Circle; return <li key={label} className={index <= active ? 'step-active' : ''}><span className="step-icon"><Icon aria-hidden="true" className={index === active ? 'stage-spinner' : ''} /></span><div><strong>{index === 0 && active === 0 ? 'Transcrevendo áudio' : label}</strong>{index < 2 && <p>{index === 0 ? 'Partes da gravação' : 'Resumo, decisões e tarefas'}</p>}</div></li>; })}</ol>}
          <Button variant="outline" className="w-full" onClick={openSession}>Ver detalhes</Button>
        </>}
        {snapshot.status === 'COMPLETED' && <>
          <CircleCheck aria-hidden="true" className="mb-5 size-10 text-success" />
          <Button className="w-full bg-ink hover:bg-ink-raised" onClick={openSession}>Abrir resultado</Button>
          {!mock && <Button variant="outline" className="w-full popup-next" disabled={disabled} onClick={() => void command('RESET_CAPTURE')}>Nova gravação</Button>}
        </>}
        {snapshot.status === 'ERROR' && <>
          <div className="popup-error-panel" role="alert"><CircleAlert aria-hidden="true" className="mb-3 size-7" /><p className="popup-failure">{mock ? snapshot.failure?.phase === 'processing' ? 'Falha no processamento simulado.' : 'Falha na captura simulada.' : snapshot.failure?.message}</p></div>
          <Button className="w-full popup-retry" disabled={disabled} onClick={() => void command(mock ? canRecover ? 'RECOVER_MOCK' : 'RESET_MOCK' : canRecover ? 'RECOVER_CAPTURE' : 'RESET_CAPTURE')}>{mock ? canRecover ? 'Tentar novamente' : 'Reiniciar simulação' : canRecover ? 'Tentar novamente' : 'Nova gravação'}</Button>
          {!mock && snapshot.failure?.hasRecoverableData && <Button variant="outline" className="w-full" onClick={openSession}>Ver partes e transcrição</Button>}
          {!mock && snapshot.failure?.phase === 'processing' && <Button variant="outline" className="w-full" onClick={openSettings}>Revisar configurações</Button>}
          {!mock && canRecover && <Button variant="link" size="sm" className="px-0" disabled={disabled} onClick={() => void command('RESET_CAPTURE')}>Arquivar sessão e iniciar outra</Button>}
        </>}
      </section>}
      {mock && <details className="popup-dev-tools"><summary>Controles de simulação</summary><div className="button-row">
        <Button variant="outline" size="sm" disabled={disabled || !['STARTING', 'STOPPING', 'PROCESSING'].includes(snapshot.status)} onClick={() => void command('ADVANCE_MOCK')}>Avançar etapa</Button>
        <Button variant="outline" size="sm" disabled={disabled || !['STARTING', 'RECORDING', 'STOPPING', 'PROCESSING'].includes(snapshot.status)} onClick={() => void command('FAIL_MOCK')}>Simular falha</Button>
        <Button variant="outline" size="sm" disabled={disabled || !canRecover} onClick={() => void command('RECOVER_MOCK')}>Recuperar processamento</Button>
        <Button variant="link" size="sm" className="px-0" disabled={disabled} onClick={() => void command('RESET_MOCK')}>Reiniciar simulação</Button>
      </div></details>}
    </>}
    {error && <div className="error-notice" role="alert"><p>{error}</p><Button variant="link" size="sm" className="px-0" onClick={() => void refresh()}>Atualizar estado</Button></div>}
    <footer className="popup-foundation" id="foundation-note">
      {!mock && <span className="sr-only">{snapshot.status === 'RECORDING' ? 'Gravação em andamento.' : 'Áudio da aba e microfone.'}</span>}
      {mock && <><p>Modo de desenvolvimento · simulação</p><p>Áudio ainda não é capturado.</p></>}
    </footer>
  </main>;
}
