import { visibleSections, type SessionView } from '../domain/contracts';

export function SessionContent({ view }: { view: SessionView }) {
  return <>
    {view.interrupted && <aside className="error-notice">Esta gravação foi interrompida. As notas cobrem apenas o áudio recuperado. <strong>Exemplo simulado.</strong></aside>}
    {view.status === 'PROCESSING' && <section className="card"><h2>Organizando suas notas · simulação</h2><ol className="progress-list"><li>✓ Parte 1 transcrita — exemplo</li><li>○ Parte 2 aguardando — exemplo</li><li>○ Organização ainda não iniciada — exemplo</li></ol></section>}
    {view.status === 'ERROR' && <section className="card"><h2>Não foi possível organizar as notas · simulação</h2><p>Este exemplo mostra um erro de processamento. Nenhuma transcrição real foi feita.</p></section>}
    {view.status === 'COMPLETED' && view.summary.length > 0 && <section className="card summary-card"><span className="eyebrow">Notas geradas · exemplo</span><h2>Resumo</h2>{view.summary.map((text, index) => <p key={index}>{text}</p>)}</section>}
    {view.status === 'COMPLETED' && view.summary.length === 0 && visibleSections(view.sections).length === 0 && <section className="card"><h2>Nenhuma nota relevante neste exemplo</h2><p>Categorias sem conteúdo ficam ocultas.</p></section>}
    {view.status === 'COMPLETED' && visibleSections(view.sections).map((section) => <section className="card" key={section.id}><h2>{section.title}</h2><ul>{section.items.map((item, index) => <li key={index}>{item}</li>)}</ul></section>)}
    {view.transcript !== null && <section className="transcript-card"><span className="eyebrow">Fonte separada das notas</span><h2>Transcrição original · exemplo simulado</h2><p className="transcript-text">{view.transcript}</p></section>}
  </>;
}
