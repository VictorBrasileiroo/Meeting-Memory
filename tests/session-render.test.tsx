import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionContent } from '../src/session/SessionContent';
import { sessionFixtures } from '../src/session/fixtures';

describe('session presentation fixtures', () => {
  it('renderiza conteúdo disponível e oculta categoria vazia', () => {
    const view = sessionFixtures.completed;
    if (!view) throw new Error('Fixture ausente.');
    const html = renderToStaticMarkup(createElement(SessionContent, { view }));
    expect(html).toContain('Principais assuntos');
    expect(html).not.toContain('Experimentos');
    expect(html).toContain('Notas geradas · exemplo');
    expect(html).toContain('Transcrição original · exemplo simulado');
  });
  it.each(['processing', 'error', 'interrupted', 'empty'])('renderiza %s honestamente', (scenario) => {
    const view = sessionFixtures[scenario];
    if (!view) throw new Error('Fixture ausente.');
    const html = renderToStaticMarkup(createElement(SessionContent, { view }));
    expect(html).not.toContain('Referências');
    if (scenario === 'interrupted') expect(html).toContain('interrompida');
    if (scenario === 'empty') expect(html).toContain('Nenhuma nota relevante');
  });
});
