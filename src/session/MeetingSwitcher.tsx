import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { filterMeetingChoices, type MeetingChoice } from './meeting-choices';

type Props = { currentId: string | null; loadChoices: () => Promise<MeetingChoice[]>; hrefFor: (id: string) => string; onChoose: (id: string) => void };

export function MeetingSwitcher({ currentId, loadChoices, hrefFor, onChoose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const pointerOutside = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<MeetingChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    if (!open) return;
    if (!dialog.current?.open) dialog.current?.showModal();
    if (window.matchMedia('(pointer: fine)').matches) search.current?.focus();
    else dialog.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setProblem('');
    void loadChoices().then(rows => { if (active) { setChoices(rows); setLoading(false); } }).catch(() => {
      if (active) { setProblem('Não foi possível carregar as reuniões. Tente novamente.'); setLoading(false); }
    });
    return () => { active = false; };
  }, [open, loadChoices, attempt]);
  const filtered = filterMeetingChoices(choices, query);
  const visible = filtered.slice(0, limit);
  function focusRow(event: KeyboardEvent, fromSearch = false) {
    if (!['ArrowDown', 'ArrowUp', ...(fromSearch ? [] : ['Home', 'End'])].includes(event.key)) return;
    const links = Array.from(list.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    if (!links.length) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : event.key === 'ArrowDown' ? (index + 1) % links.length : index <= 0 ? links.length - 1 : index - 1;
    links[next]?.focus();
  }
  function outside(x: number, y: number) {
    const rect = dialog.current?.getBoundingClientRect();
    return !!rect && (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom);
  }
  return <>
    <Button variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={open} aria-controls="meeting-switcher" onClick={() => { setQuery(''); setLimit(30); setOpen(true); }}>
      Trocar reunião<ChevronsUpDown aria-hidden="true" />
    </Button>
    <dialog id="meeting-switcher" ref={dialog} className="meeting-switcher" aria-labelledby="switcher-title" aria-describedby="switcher-description" onClose={() => setOpen(false)}
      onPointerDown={event => { pointerOutside.current = event.target === event.currentTarget && outside(event.clientX, event.clientY); }}
      onClick={event => { if (pointerOutside.current && event.target === event.currentTarget && outside(event.clientX, event.clientY)) dialog.current?.close(); }}>
      {open && <div className="switcher-body">
        <header className="switcher-heading"><div><h2 id="switcher-title" tabIndex={-1}>Trocar reunião</h2><p id="switcher-description">Busque por título, perfil ou data</p></div><Button className="size-11" variant="ghost" size="icon" aria-label="Fechar seletor de reuniões" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></Button></header>
        <div className="switcher-search"><Search aria-hidden="true" /><label className="sr-only" htmlFor="meeting-search">Buscar reuniões</label><Input className="pl-10" id="meeting-search" ref={search} type="search" name="meeting-search" autoComplete="off" spellCheck={false} placeholder="Buscar reuniões…" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); }} onKeyDown={event => focusRow(event, true)} /></div>
        <div className="switcher-results" aria-busy={loading}>
          {loading ? <p className="switcher-empty" role="status">Carregando reuniões…</p> : problem ? <div className="switcher-empty"><p role="alert">{problem}</p><Button variant="secondary" size="sm" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></div> : !choices.length ? <div className="switcher-empty"><h3>Nenhuma reunião salva</h3><p>As reuniões aparecerão aqui depois da primeira gravação.</p></div> : !filtered.length ? <div className="switcher-empty"><h3>Nenhuma reunião encontrada</h3><p>Tente outro título, perfil ou data.</p><Button variant="secondary" size="sm" onClick={() => { setQuery(''); search.current?.focus(); }}>Limpar busca</Button></div> : <>
            <ul ref={list} className="switcher-list" aria-label="Reuniões salvas" onKeyDown={event => focusRow(event)}>{visible.map(choice => <li key={choice.id}>
              <a href={choice.id === currentId ? window.location.href : hrefFor(choice.id)} aria-current={choice.id === currentId ? 'page' : undefined} onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); dialog.current?.close(); onChoose(choice.id);
              }}><div className="switcher-row-heading"><span className="switcher-row-title" title={choice.title}>{choice.title}</span>{choice.id === currentId && <span className="switcher-current"><Check aria-hidden="true" />Aberta</span>}</div>
                <div className="switcher-row-meta"><time dateTime={new Date(choice.createdAt).toISOString()}>{new Date(choice.createdAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</time><span>{choice.profile}</span><span className={`switcher-phase phase-${choice.tone}`}>{choice.status}</span></div>
              </a>
            </li>)}</ul>
            {filtered.length > limit && <div className="switcher-more"><Button variant="ghost" size="sm" onClick={() => setLimit(value => value + 30)}>Mostrar mais reuniões</Button></div>}
          </>}
        </div>
        <footer className="switcher-footer"><span role="status" aria-live="polite" aria-atomic="true">{!loading && !problem && `${filtered.length} ${filtered.length === 1 ? 'reunião' : 'reuniões'} ${query.trim() ? filtered.length === 1 ? 'encontrada' : 'encontradas' : filtered.length === 1 ? 'salva' : 'salvas'}`}</span><span className="switcher-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir <kbd>Esc</kbd> fechar</span></footer>
      </div>}
    </dialog>
  </>;
}
