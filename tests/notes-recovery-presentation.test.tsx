import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotesContent } from '../src/session/NotesContent';
import { notesMarkdown } from '../src/session/notes-export';
import { meetingNotes } from './fixtures/notes';

it('avisa limitações na leitura e na cópia/exportação sem reconstruir conteúdo omitido', () => {
  const notes = meetingNotes();
  notes.validation = { version: 1, omittedItems: 1, recoveredQuotes: 1, issues: [{ code: 'EVIDENCE_NOT_FOUND', count: 1 }] };
  const html = renderToStaticMarkup(<NotesContent notes={notes} />);
  expect(html).toContain('Notas com limitações'); expect(html).toContain('1 item foi omitido');
  expect(html).toContain('role="status"'); expect(html).toContain('aria-live="polite"');
  expect(notesMarkdown(notes)).toContain('1 item foi omitido');
  expect(notesMarkdown(notes)).toContain('Corrigir o bug.');
});
