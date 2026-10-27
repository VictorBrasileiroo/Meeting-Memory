import { useEffect, useRef, useState } from 'react';
import { AlignLeft, ArrowUpRight, BookOpen, CalendarClock, ChevronDown, CircleCheck, CircleHelp, ClipboardList, Clock, Copy, Download, FileText, Layers, Lightbulb, Link2, List, ListChecks, PenLine, TriangleAlert } from 'lucide-react';
import { sectionLabels, type MeetingNotes, type NotesOutput } from '../domain/notes';
import { Button } from '../components/ui/button';
import { copyNotes, downloadNotes, natureLabel } from './notes-export';
import { meetingTitle } from './session-data';
import { notesLimitation } from '../domain/notes-validation';

export type SourceReference = NotesOutput['summary'][number]['evidence'][number];
export type SourceNavigation = (ref: SourceReference, returnId: string) => void;

function Evidence({ refs, id, onSource, onToggle, parts }: { refs: SourceReference[]; id: string; onSource?: SourceNavigation; parts: { id: string; index: number }[]; onToggle?: (id: string, refs: SourceReference[], open: boolean) => void }) {
  return <details className="evidence" id={id} onToggle={event => onToggle?.(id, refs, event.currentTarget.open)}><summary title="Ver evidência na transcrição"><Link2 aria-hidden="true" /><span>Ver fonte</span><span className="evidence-part">{[...new Set(refs.flatMap(ref => { const part = parts.find(part => part.id === ref.chunkId); return part ? [`parte ${part.index}`] : []; }))].join(", ")}</span><ChevronDown aria-hidden="true" className="evidence-chevron" /></summary>
    <div className="evidence-quotes">{refs.map((ref, index) => <blockquote key={index}>
      <p><mark>{ref.quote}</mark></p>{parts.some(part => part.id === ref.chunkId) && <span>Trecho da parte {parts.find(part => part.id === ref.chunkId)?.index} · </span>}
      <a href={`#source-${encodeURIComponent(ref.chunkId)}`} onClick={onSource ? event => { event.preventDefault(); onSource(ref, id); } : undefined}>Abrir na transcrição<ArrowUpRight aria-hidden="true" className="size-3.5" /></a>
    </blockquote>)}</div>
  </details>;
}

export function NotesActions({ notes }: { notes: MeetingNotes }) {
  const [notice, setNotice] = useState('');
  return <div className="notes-actions">
    <div className="document-toolbar"><div className="flex flex-wrap gap-1">
      <Button size="sm" className="bg-ink hover:bg-ink-raised" onClick={() => void copyNotes(notes).then(() => setNotice('Notas copiadas.')).catch(() => setNotice('Não foi possível copiar. Permita o acesso à área de transferência e tente novamente.'))}><Copy aria-hidden="true" />Copiar notas</Button>
      <Button size="sm" variant="ghost" onClick={() => { try { downloadNotes(notes); setNotice('Arquivo Markdown preparado.'); } catch { setNotice('Não foi possível exportar. Tente novamente.'); } }}><Download aria-hidden="true" /><span><span className="max-[600px]:sr-only">Exportar </span>Markdown</span></Button>
    </div></div>
    <p className="action-feedback" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
  </div>;
}

const sectionIcons: Record<string, typeof FileText> = { decisions: CircleCheck, methodologicalDecisions: CircleCheck, architectureDecisions: Layers, requestedChanges: PenLine, risks: TriangleAlert, issues: TriangleAlert, pending: Clock, questions: CircleHelp, requirements: ClipboardList, hypotheses: Lightbulb, references: BookOpen };
export function NotesContent({ notes, onSource, onEvidenceChange, parts = [], showTitle = true, showActions = true }: { notes: MeetingNotes; onSource?: SourceNavigation; parts?: { id: string; index: number }[]; onEvidenceChange?: (parts: string[]) => void; showTitle?: boolean; showActions?: boolean }) {
  const openEvidence = useRef(new Map<string, SourceReference[]>());
  function evidenceToggle(id: string, refs: SourceReference[], open: boolean) {
    if (open) openEvidence.current.set(id, refs); else openEvidence.current.delete(id);
    onEvidenceChange?.([...new Set([...openEvidence.current.values()].flat().map(ref => ref.chunkId))]);
  }
  useEffect(() => () => onEvidenceChange?.([]), [onEvidenceChange]);
  const output = notes.output;
  const sections = output.sections.filter(section => section.items.length);
  const index = [...(output.summary.length ? [{ id: 'summary', title: 'Resumo' }] : []), ...sections.map(section => ({ id: section.kind, title: sectionLabels[section.kind] })), ...(output.tasks.length ? [{ id: 'tasks', title: 'Tarefas' }] : [])];
  const documentRef = useRef<HTMLDivElement>(null);
  const [currentSection, setCurrentSection] = useState(index[0]?.id ?? '');
  const sectionKey = index.map(item => item.id).join(',');
  useEffect(() => {
    const visible = new Set<Element>();
    const sections = Array.from(documentRef.current?.querySelectorAll('.reading-section') ?? []);
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      const first = sections.find(section => visible.has(section));
      if (first) setCurrentSection(first.id.replace(/^notes-/, ''));
    // Start below the 32px anchor inset so a sliver of the preceding section
    // cannot keep it selected after navigating to the next heading.
    }, { rootMargin: '-40px 0px -60% 0px' });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [sectionKey]);
  return <div className="notes-layout" ref={documentRef}>
    {index.length > 2 && <nav className="document-index" aria-label="Nesta nota"><span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><List aria-hidden="true" className="size-3.5" />Nesta nota</span><ol>{index.map((item, position) => <li key={item.id}><a href={`#notes-${item.id}`} aria-current={currentSection === item.id ? 'location' : undefined}><span aria-hidden="true">{String(position + 1).padStart(2, '0')}</span>{item.title}</a></li>)}</ol></nav>}
    <article className="notes-document reading-column" aria-label="Notas geradas">
      {showTitle && <h1>{meetingTitle({ profile: notes.profile, createdAt: notes.createdAt }, notes)}</h1>}
      {showActions && <NotesActions notes={notes} />}
      {notes.validation && <aside className="mb-6 text-sm text-muted-foreground" role="status" aria-live="polite"><p className="mb-1 font-medium text-foreground">{notes.validation.omittedItems ? 'Notas com limitações' : 'Fontes verificadas'}</p><p>{notesLimitation(notes.validation)}</p></aside>}
      {output.summary.length > 0 && <section className="reading-section notes-summary" id="notes-summary" tabIndex={-1}><h2><AlignLeft aria-hidden="true" />Resumo</h2>{output.summary.map((item, index) => <div className="note-item" key={index}><p>{item.nature !== 'established' && <strong className="nature-label">{natureLabel(item.nature)}</strong>}{item.text}</p><Evidence id={`evidence-summary-${index}`} refs={item.evidence} onSource={onSource} parts={parts} onToggle={evidenceToggle} /></div>)}</section>}
      {sections.map(section => { const Icon = sectionIcons[section.kind] ?? FileText; return <section className="reading-section" id={`notes-${section.kind}`} tabIndex={-1} key={section.kind}><h2><Icon aria-hidden="true" className={section.kind === "decisions" ? "text-success" : ["risks", "issues"].includes(section.kind) ? "text-warning" : "text-muted-foreground"} />{sectionLabels[section.kind]}</h2><ul className="note-list">{section.items.map((item, index) => <li key={index}><p>{item.nature !== 'established' && <strong className="nature-label">{natureLabel(item.nature)}</strong>}{item.text}</p><Evidence id={`evidence-${section.kind}-${index}`} refs={item.evidence} onSource={onSource} parts={parts} onToggle={evidenceToggle} /></li>)}</ul></section>; })}
      {output.tasks.length > 0 && <section className="reading-section" id="notes-tasks" tabIndex={-1}><h2><ListChecks aria-hidden="true" className="text-primary" />Tarefas</h2><ol className="task-list">{output.tasks.map((task, index) => <li key={index}><p>{task.description}</p>{(task.owner || task.deadline) && <div className="task-meta">{task.owner && <span className="task-chip"><span aria-hidden="true" className="task-initial">{task.owner.trim().charAt(0).toLocaleUpperCase("pt-BR")}</span><span className="sr-only">{`Responsável: ${task.owner}`}</span><span aria-hidden="true">{task.owner}</span></span>}{task.deadline && <span className="task-chip"><CalendarClock aria-hidden="true" /><span className="sr-only">{`Prazo: ${task.deadline}`}</span><span aria-hidden="true">{task.deadline}</span></span>}</div>}<Evidence id={`evidence-task-${index}`} refs={task.evidence} onSource={onSource} parts={parts} onToggle={evidenceToggle} /></li>)}</ol></section>}
      {!index.length && <section className="empty-reading"><h2>Nenhuma nota relevante</h2><p>Não encontramos conteúdo suficiente para organizar notas.</p><p className="text-sm text-muted-foreground">A transcrição original continua disponível na aba Transcrição.</p></section>}
      <details className="reading-footnote generation-details"><summary>Sobre estas notas</summary><p>A transcrição é a fonte preservada; as notas são interpretação.</p>{notes.validation && <ul>{notes.validation.issues.map(issue => <li key={issue.code}>{issue.code}: {issue.count}</li>)}</ul>}<p>Modelo utilizado: {notes.analysisModel}</p><p>Gerado em {new Date(notes.createdAt).toLocaleString('pt-BR')}</p></details>
    </article>
  </div>;
}
