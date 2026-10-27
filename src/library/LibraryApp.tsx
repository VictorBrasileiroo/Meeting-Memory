import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowDownWideNarrow, ArrowUpRight, AudioLines, Check, ChevronLeft, ChevronRight, Files, HardDrive, LockKeyhole, RefreshCw, Search, Settings, Trash2, VolumeX, X } from 'lucide-react';
import { Brand } from '../components/Brand';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { onMeetingChange } from '../storage/meeting-events';
import type { CleanupSummary, ManagedMeeting, ManagementAction } from '../storage/meeting-management';
import { librarySource, type LibrarySource } from './library-source';
import { formatBytes, librarySearch, meetingHref, PAGE_SIZE, readLibraryState, totalBytes, visibleMeetings, type LibraryState } from './library-model';

type Outcome = { id: string; title: string; ok: boolean; message: string };
type Confirmation = { type: ManagementAction; rows: ManagedMeeting[] };
type OriginUsage = { usage: number; quota: number };
const inkButton = 'bg-ink text-white hover:bg-ink-raised';
const reasonFor = (row: ManagedMeeting, type: ManagementAction) => type === 'DELETE_RECORDING' ? row.deleteReason : row.audioReason;

export function LibraryApp() {
  const [state, setState] = useState(() => readLibraryState(window.location.search));
  const [rows, setRows] = useState<ManagedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [measuring, setMeasuring] = useState(false);
  const [records, setRecords] = useState(0);
  const [problem, setProblem] = useState('');
  const [measurementProblem, setMeasurementProblem] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(() => window.matchMedia('(min-width: 760px)').matches);
  const [storageExpanded, setStorageExpanded] = useState(() => window.matchMedia('(min-width: 760px)').matches);
  const [usage, setUsage] = useState<OriginUsage | null>(null);
  const [unassociated, setUnassociated] = useState(0);
  const [cleanup, setCleanup] = useState<CleanupSummary>({ pending: 0, failed: 0, waitingForCredentials: 0 });
  const [selected, setSelected] = useState(new Set<string>());
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [finished, setFinished] = useState(false);
  const source = useRef<Promise<LibrarySource> | undefined>(undefined);
  const abortScan = useRef<AbortController | undefined>(undefined);
  const operationActive = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const selectPage = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    abortScan.current?.abort(); const controller = new AbortController(); abortScan.current = controller;
    setProblem(''); setMeasurementProblem(''); setMeasuring(true); setRecords(0);
    try {
      const repository = await (source.current ??= librarySource());
      const list = await repository.list(); if (controller.signal.aborted) return;
      setRows(list); setLoading(false);
      setSelected(previous => new Set([...previous].filter(id => list.some(row => row.id === id))));
      try {
        const estimate = await (repository.estimate ? repository.estimate() : navigator.storage?.estimate());
        if (!controller.signal.aborted) setUsage(estimate && Number.isFinite(estimate.usage) && Number.isFinite(estimate.quota) && estimate.quota! > 0 ? { usage: estimate.usage!, quota: estimate.quota! } : null);
      } catch { if (!controller.signal.aborted) setUsage(null); }
      const cleanups = await repository.cleanup(); if (!controller.signal.aborted) setCleanup(cleanups);
      try {
        const measured = await repository.measure(list, count => { if (!controller.signal.aborted) setRecords(count); }, controller.signal);
        if (!controller.signal.aborted) { setRows(measured.rows); setUnassociated(measured.unassociatedAudioBytes); }
      } catch { if (!controller.signal.aborted) setMeasurementProblem('Não foi possível medir o conteúdo. Atualize para tentar novamente. Nenhum dado foi alterado.'); }
    } catch { if (!controller.signal.aborted) { setProblem('Não foi possível ler as reuniões. Feche outras páginas antigas da extensão e tente atualizar.'); setLoading(false); } }
    finally { if (!controller.signal.aborted) setMeasuring(false); }
  }, []);
  useEffect(() => { void reload(); return () => abortScan.current?.abort(); }, [reload]);
  useEffect(() => onMeetingChange(() => { if (!operationActive.current) void reload(); }), [reload]);
  useEffect(() => {
    const sync = () => { setState(readLibraryState(window.location.search)); setSelected(new Set()); };
    const visible = () => { if (document.visibilityState === 'visible' && !operationActive.current) void reload(); };
    window.addEventListener('popstate', sync); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('popstate', sync); document.removeEventListener('visibilitychange', visible); };
  }, [reload]);

  function update(next: Partial<LibraryState>, clearSelection = false) {
    const value = { ...state, ...next }; setState(value);
    const search = librarySearch(value); window.history.replaceState(null, '', `${window.location.pathname}${search ? '?' + search : ''}`);
    if (clearSelection) setSelected(new Set());
  }
  const filtered = visibleMeetings(rows, state);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(state.page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = rows.filter(row => selected.has(row.id));
  const selectedOnPage = visible.filter(row => selected.has(row.id)).length;
  useEffect(() => { if (selectPage.current) selectPage.current.indeterminate = selectedOnPage > 0 && selectedOnPage < visible.length; }, [selectedOnPage, visible.length]);
  const completeMeasurement = !problem && !loading && !measuring && !measurementProblem && rows.every(row => row.size !== null);
  const audioBytes = rows.reduce((sum, row) => sum + (row.size?.audioBytes ?? 0), 0);
  const textBytes = rows.reduce((sum, row) => sum + (row.size?.textBytes ?? 0), 0);
  const metadataBytes = rows.reduce((sum, row) => sum + (row.size?.metadataBytes ?? 0), 0);
  function toggle(id: string) { setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function open(type: ManagementAction, items: ManagedMeeting[], event: MouseEvent<HTMLButtonElement>) {
    trigger.current = event.currentTarget; setConfirmation({ type, rows: items }); setOutcomes([]); setFinished(false); setCurrent('');
  }
  async function perform() {
    if (!confirmation || operationActive.current) return;
    const previous = new Map(outcomes.map(outcome => [outcome.id, outcome]));
    const candidates = confirmation.rows.filter(row => !reasonFor(row, confirmation.type) && previous.get(row.id)?.ok !== true);
    if (!candidates.length) return;
    operationActive.current = true; setRunning(true); setFinished(false);
    const next = [...outcomes.filter(outcome => outcome.ok)];
    try {
      const repository = await (source.current ??= librarySource());
      for (const [index, row] of candidates.entries()) {
        setCurrent(`${index + 1} de ${candidates.length}: ${row.title}`);
        try {
          const result = await repository.mutate(row.id, confirmation.type);
          next.push({ id: row.id, title: row.title, ok: true, message: confirmation.type === 'DELETE_RECORDING' ? result.cleanupPending ? 'Reunião excluída localmente. Limpeza remota pendente.' : 'Reunião excluída.' : `Áudio removido: ${formatBytes(result.removedAudioBytes)} de conteúdo.` });
          setSelected(selection => { const copy = new Set(selection); copy.delete(row.id); return copy; });
        } catch (error) {
          next.push({ id: row.id, title: row.title, ok: false, message: error instanceof Error ? error.message : 'A operação falhou. Atualize a lista antes de repetir.' });
        }
        setOutcomes([...next]);
      }
    } finally {
      operationActive.current = false; setRunning(false); setFinished(true); setCurrent(''); await reload();
    }
  }

  const affected = confirmation?.rows.filter(row => !reasonFor(row, confirmation.type)) ?? [];
  const blocked = confirmation?.rows.filter(row => reasonFor(row, confirmation.type)) ?? [];
  const removalSize = affected.reduce((sum, row) => sum + (confirmation?.type === 'DELETE_RECORDING' ? totalBytes(row) : row.size?.audioBytes ?? 0), 0);
  const completed = outcomes.filter(outcome => outcome.ok).length;
  return <div className="library-app min-h-screen bg-paper text-foreground">
    <a href="#library-content" className="library-skip">Ir para as reuniões</a>
    <header className="bg-ink text-white"><div className="library-container flex flex-wrap items-center justify-between gap-4 py-5"><Brand compact className="text-white [&_span_span]:text-muted-on-ink" /><nav aria-label="Navegação principal" className="flex items-center gap-2"><span className="hidden px-3 text-sm font-semibold min-[760px]:inline" aria-current="page">Reuniões</span><Button asChild variant="ghost" size="sm" className="text-muted-on-ink hover:bg-ink-raised hover:text-white"><a href="../settings/settings.html"><Settings aria-hidden="true" /><span className="max-[759px]:sr-only">Configurações</span></a></Button></nav></div></header>
    <main id="library-content" className="library-container pb-20 pt-10 min-[760px]:pt-14" tabIndex={-1}>
      {__FOUNDATION_MOCK__ && <p className="mb-6 text-sm text-primary">Prévia de gerenciamento · reuniões fictícias. As ações desta prévia não alteram dados reais.</p>}
      <div className="flex flex-wrap items-start justify-between gap-5"><div><h1 id="library-heading" tabIndex={-1} className="m-0 max-w-[22ch] text-[clamp(32px,4vw,44px)] leading-[1.08] font-semibold tracking-[-.04em]">Reuniões e armazenamento</h1><p className="mt-4 mb-0 text-muted-foreground">Consulte suas reuniões e escolha o que manter neste perfil.</p></div><Button variant="outline" disabled={loading || measuring || running} onClick={() => void reload()}><RefreshCw aria-hidden="true" />Atualizar</Button></div>
      <details className="storage-panel mt-7" open={storageExpanded} onToggle={event => setStorageExpanded(event.currentTarget.open)}><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-y border-border py-3 text-sm font-medium"><span className="flex items-center gap-2"><HardDrive aria-hidden="true" className="size-4" />Armazenamento local</span><span className="text-xs font-normal text-muted-foreground">{usage ? `${formatBytes(usage.usage)} estimados` : 'Estimativa indisponível'}<span aria-hidden="true" className="ml-2">⌄</span></span></summary>
      <section aria-label="Armazenamento local" className="storage-overview mt-0 grid gap-6 border-y border-border py-6 min-[760px]:grid-cols-[1.4fr_1fr_1fr]">
        <div><p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><HardDrive aria-hidden="true" className="size-4" />Uso estimado neste perfil</p><p className="m-0 text-2xl font-semibold tracking-tight tabular-nums">{usage ? formatBytes(usage.usage) : 'Indisponível'}</p><p className="mt-1 mb-0 text-xs text-muted-foreground">{usage ? `de ${formatBytes(usage.quota)} de quota estimada` : 'O navegador não forneceu uma estimativa.'}</p></div>
        <div><p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><AudioLines aria-hidden="true" className="size-4" />Áudio local</p><p className="m-0 text-2xl font-semibold tracking-tight tabular-nums">{completeMeasurement ? formatBytes(audioBytes) : '—'}</p><p className="mt-1 mb-0 text-xs text-muted-foreground">Inclui fragmentos associados às reuniões.</p></div>
        <div><p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Files aria-hidden="true" className="size-4" />Notas e transcrições</p><p className="m-0 text-2xl font-semibold tracking-tight tabular-nums">{completeMeasurement ? formatBytes(textBytes) : '—'}</p><p className="mt-1 mb-0 text-xs text-muted-foreground">{completeMeasurement ? `${formatBytes(metadataBytes)} adicionais em metadados estimados.` : 'Conteúdo estimado, medido separadamente.'}</p></div>
      </section>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">A quota é da extensão, não o espaço livre do computador. Os tamanhos por reunião estimam o conteúdo e não incluem todo o custo do IndexedDB. O navegador pode demorar para atualizar o uso após uma limpeza.</p>
      </details>
      <div className="mt-3 min-h-6 text-sm text-muted-foreground" role="status" aria-live="polite">{measuring ? `Medindo conteúdo local… ${new Intl.NumberFormat('pt-BR').format(records)} registros verificados.` : measurementProblem || ''}</div>
      {unassociated > 0 && <p className="text-sm text-warning">Há {formatBytes(unassociated)} de áudio temporário sem reunião associada. Esse material está preservado e não será removido por estas ações.</p>}
      {(cleanup.pending + cleanup.failed + cleanup.waitingForCredentials > 0) && <aside className="mt-3 border-l-2 border-warning pl-4 text-sm text-muted-foreground"><p className="mb-1 font-semibold text-foreground">Limpeza remota de reuniões excluídas</p><p className="m-0">{cleanup.pending} {cleanup.pending === 1 ? 'arquivo pendente' : 'arquivos pendentes'}, {cleanup.failed} com falha e {cleanup.waitingForCredentials} aguardando credenciais. A exclusão local já foi concluída. Atualize para conferir o estado; revise a chave nas configurações quando necessário.</p></aside>}
      <section aria-label="Buscar e filtrar reuniões" className="library-filters mt-4 grid gap-4 min-[1100px]:grid-cols-[minmax(180px,1fr)_minmax(0,600px)]">
        <div><label htmlFor="library-search" className="mb-2 block text-xs font-medium text-muted-foreground">Buscar reuniões</label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" /><Input id="library-search" name="q" type="search" autoComplete="off" spellCheck={false} placeholder="Título, perfil ou data…" className="pl-10" disabled={running} value={state.q} onChange={event => update({ q: event.target.value, page: 1 }, true)} /></div></div>
        <details className="filter-options" open={filtersExpanded} onToggle={event => setFiltersExpanded(event.currentTarget.open)}><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium"><span>Filtros e ordenação</span><span className="text-xs font-normal text-muted-foreground">{state.status !== 'all' || state.audio !== 'all' || state.sort !== 'newest' ? 'Aplicados' : 'Mais recentes'}<span aria-hidden="true" className="ml-2">⌄</span></span></summary><div className="filter-controls grid gap-4 min-[760px]:grid-cols-3"><div><label htmlFor="library-status" className="mb-2 block text-xs font-medium text-muted-foreground">Estado</label><NativeSelect id="library-status" name="status" autoComplete="off" value={state.status} disabled={running} onChange={event => update({ status: event.target.value, page: 1 }, true)}><option value="all">Todos</option>{[...new Set(rows.map(row => row.status))].sort().map(status => <option key={status}>{status}</option>)}</NativeSelect></div>
        <div><label htmlFor="library-audio" className="mb-2 block text-xs font-medium text-muted-foreground">Áudio</label><NativeSelect id="library-audio" name="audio" autoComplete="off" value={state.audio} disabled={running || !completeMeasurement} onChange={event => update({ audio: event.target.value as LibraryState['audio'], page: 1 }, true)}><option value="all">Todo áudio</option><option value="with">Com áudio local</option><option value="without">Sem áudio local</option></NativeSelect></div>
        <div><label htmlFor="library-sort" className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground"><ArrowDownWideNarrow aria-hidden="true" className="size-3" />Ordenar</label><NativeSelect id="library-sort" name="sort" autoComplete="off" value={state.sort} disabled={running} onChange={event => update({ sort: event.target.value as LibraryState['sort'], page: 1 })}><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="largest" disabled={!completeMeasurement}>Maiores primeiro</option></NativeSelect></div></div></details>
      </section>
      <div className="selection-toolbar mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex flex-wrap items-center gap-3"><label className="selection-label flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input ref={selectPage} type="checkbox" aria-label="Selecionar reuniões desta página" disabled={!visible.length || running} checked={!!visible.length && selectedOnPage === visible.length} onChange={() => setSelected(previous => { const next = new Set(previous); for (const row of visible) if (selectedOnPage === visible.length) next.delete(row.id); else next.add(row.id); return next; })} /><span>{selected.size ? `${selected.size} ${selected.size === 1 ? 'selecionada' : 'selecionadas'}` : `${filtered.length} ${filtered.length === 1 ? 'reunião' : 'reuniões'}`}</span></label>{selected.size > 0 && <Button size="sm" variant="ghost" disabled={running} onClick={() => setSelected(new Set())}><X aria-hidden="true" />Limpar seleção</Button>}</div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!selectedRows.length || !completeMeasurement || running} onClick={event => open('REMOVE_RECORDING_AUDIO', selectedRows, event)}><VolumeX aria-hidden="true" />Remover áudio</Button><Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft hover:text-destructive" disabled={!selectedRows.length || !completeMeasurement || running} onClick={event => open('DELETE_RECORDING', selectedRows, event)}><Trash2 aria-hidden="true" />Excluir reuniões</Button></div>
      </div>
      {problem ? <div className="library-empty" role="alert"><h2>Não foi possível abrir a biblioteca</h2><p>{problem}</p><Button variant="outline" onClick={() => void reload()}>Tentar novamente</Button></div> : loading ? <p className="library-empty" role="status">Carregando reuniões…</p> : !rows.length ? <div className="library-empty"><Files aria-hidden="true" className="mx-auto mb-5 size-9 text-muted-foreground" /><h2>Nenhuma reunião salva</h2><p>Abra a extensão na aba da reunião para iniciar uma gravação.</p></div> : !visible.length ? <div className="library-empty"><h2>Nenhuma reunião encontrada</h2><p>Tente outro título, perfil, data ou filtro.</p><Button variant="outline" onClick={() => update({ q: '', status: 'all', audio: 'all', page: 1 }, true)}>Limpar busca e filtros</Button></div> : <ul className="meeting-list m-0 list-none p-0" aria-label="Reuniões salvas">{visible.map(row => <li key={row.id} className="meeting-row grid items-center gap-4 border-b border-border py-5">
        <label className="selection-label flex min-h-11 items-center justify-center"><input type="checkbox" aria-label={`Selecionar ${row.title}`} disabled={running} checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></label>
        <div className="min-w-0"><a href={meetingHref(row.id, { ...state, page })} className="meeting-title no-underline text-base leading-snug font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">{row.title}</a><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><time dateTime={new Date(row.createdAt).toISOString()}>{new Date(row.createdAt).toLocaleDateString('pt-BR', { dateStyle: 'medium' })}</time><span>{row.profile}</span><span>{row.hasNotes ? 'Com notas' : 'Sem notas'} · {row.transcriptCount ? `${row.transcriptCount} ${row.transcriptCount === 1 ? 'parte transcrita' : 'partes transcritas'}` : 'Sem transcrição'}</span></div><p className="mt-2 mb-0 text-xs text-muted-foreground">{row.size ? row.size.audioBytes ? `Áudio local: ${formatBytes(row.size.audioBytes)}` : 'Sem áudio local' : 'Verificando áudio…'}</p>{row.deleteReason && <p className="mt-2 mb-0 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><LockKeyhole aria-hidden="true" className="mt-0.5 size-3 shrink-0" />{row.deleteReason}</p>}</div>
        <div className="meeting-state text-sm text-muted-foreground"><span className={row.tone === 'error' ? 'text-destructive' : row.status === 'Notas prontas' ? 'text-success' : ''}>{row.status}</span><span className="mt-1 block text-xs tabular-nums">{row.size ? `${formatBytes(totalBytes(row))} estimados` : 'Medindo…'}</span></div>
        <div className="meeting-actions flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={`Remover áudio de ${row.title}`} title="Remover áudio" disabled={!completeMeasurement || running} onClick={event => open('REMOVE_RECORDING_AUDIO', [row], event)}><VolumeX aria-hidden="true" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${row.title}`} title="Excluir reunião" className="text-destructive hover:bg-destructive-soft hover:text-destructive" disabled={!completeMeasurement || running} onClick={event => open('DELETE_RECORDING', [row], event)}><Trash2 aria-hidden="true" /></Button><a href={meetingHref(row.id, { ...state, page })} aria-label={`Abrir ${row.title}`} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary"><ArrowUpRight aria-hidden="true" className="size-4" /></a></div>
      </li>)}</ul>}
      {filtered.length > PAGE_SIZE && <nav aria-label="Páginas de reuniões" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>Página {page} de {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || running} onClick={() => update({ page: page - 1 })}><ChevronLeft aria-hidden="true" />Anterior</Button><Button variant="outline" disabled={page >= pages || running} onClick={() => update({ page: page + 1 })}>Próxima<ChevronRight aria-hidden="true" /></Button></div></nav>}
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">A limpeza é manual. Reuniões gravando, processando ou aguardando credenciais permanecem protegidas. Para guardar uma cópia das notas, abra a reunião e use Exportar Markdown.</p>
    </main>
    <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open && !operationActive.current) setConfirmation(undefined); }}>
      <AlertDialogContent className="max-w-xl" onEscapeKeyDown={event => { if (running) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); if (trigger.current?.isConnected) trigger.current.focus(); else document.getElementById('library-heading')?.focus(); }}>
        <AlertDialogHeader><AlertDialogTitle>{confirmation?.type === 'DELETE_RECORDING' ? 'Excluir reuniões?' : 'Remover o áudio?'}</AlertDialogTitle><AlertDialogDescription>{confirmation?.type === 'DELETE_RECORDING' ? 'Áudio, notas e transcrição serão excluídos deste perfil. Esta ação não pode ser desfeita.' : 'Você manterá notas e transcrição. Não poderá ouvir nem retranscrever o áudio removido.'}</AlertDialogDescription></AlertDialogHeader>
        {!finished && !running && <p className="m-0 text-sm">{affected.length} {affected.length === 1 ? 'reunião elegível' : 'reuniões elegíveis'} · {formatBytes(removalSize)} de conteúdo estimado.</p>}
        <ul className="confirmation-list m-0 max-h-[28dvh] list-none overflow-y-auto p-0" aria-label="Reuniões desta operação">{confirmation?.rows.map(row => { const reason = reasonFor(row, confirmation.type); const outcome = outcomes.find(outcome => outcome.id === row.id); return <li key={row.id} className="border-b border-border py-3 text-sm"><p className="m-0 font-semibold">{row.title}</p><p className={`mt-1 mb-0 text-xs leading-relaxed ${outcome && !outcome.ok ? 'text-destructive' : 'text-muted-foreground'}`}>{outcome ? outcome.message : reason ? `Protegida: ${reason}` : confirmation.type === 'DELETE_RECORDING' ? 'Excluir áudio, notas e transcrição.' : 'Remover somente o áudio.'}</p></li>; })}</ul>
        {blocked.length > 0 && <p className="m-0 text-xs leading-relaxed text-muted-foreground">{blocked.length} {blocked.length === 1 ? 'reunião protegida não será alterada' : 'reuniões protegidas não serão alteradas'}. Os motivos estão indicados acima.</p>}
        <p className="m-0 min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">{running ? `Processando ${current}` : finished ? `${completed} ${completed === 1 ? 'operação concluída' : 'operações concluídas'}; ${outcomes.length - completed} com falha.` : ''}</p>
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">Mantenha esta página aberta até o lote terminar. A limpeza remota de arquivos conhecidos pode continuar depois da exclusão local. Ela não representa toda a política de retenção do provedor.</p>
        <AlertDialogFooter><AlertDialogCancel disabled={running}>{finished ? 'Fechar' : 'Voltar'}</AlertDialogCancel>{(!finished || outcomes.some(outcome => !outcome.ok)) && <Button className={confirmation?.type === 'DELETE_RECORDING' ? '' : inkButton} variant={confirmation?.type === 'DELETE_RECORDING' ? 'destructive' : 'default'} disabled={running || !affected.length} onClick={() => void perform()}>{running ? 'Aguarde…' : finished ? 'Tentar novamente as falhas' : confirmation?.type === 'DELETE_RECORDING' ? 'Excluir reuniões elegíveis' : 'Remover áudio elegível'}{finished && <Check aria-hidden="true" />}</Button>}</AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
