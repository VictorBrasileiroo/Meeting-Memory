import { describe, expect, it } from 'vitest';
import { fixtureSource } from '../src/library/library-fixtures';
import { formatBytes, libraryReturnHref, librarySearch, meetingHref, PAGE_SIZE, readLibraryState, visibleMeetings } from '../src/library/library-model';

it('mantém busca, filtros, ordem e página em URLs locais sem aceitar destino externo', () => {
  const state = readLibraryState('?q=reuni%C3%A3o&status=Notas+prontas&audio=with&sort=largest&page=2');
  const href = meetingHref('id & especial', state); expect(href).toContain('recordingId=id+%26+especial');
  const params = href.slice(href.indexOf('?'), href.indexOf('#'));
  expect(libraryReturnHref(params)).toBe('../library/library.html?' + librarySearch(state));
  expect(libraryReturnHref('?library=https://external.example/')).toBe('../library/library.html');
  expect(readLibraryState('?page=-1&sort=bad&audio=bad')).toMatchObject({ page: 1, sort: 'newest', audio: 'all' });
});
it('busca sem acentos, filtra áudio, ordena tamanho e oferece páginas de 30', async () => {
  const source = fixtureSource(); const { rows } = await source.measure(await source.list(), () => undefined);
  const found = visibleMeetings(rows, readLibraryState('?q=integracao&audio=with&sort=largest'));
  expect(found.length).toBeGreaterThan(1); expect(found.every(row => row.title.includes('integração') && row.size!.audioBytes > 0)).toBe(true);
  expect(found[0]!.size!.audioBytes).toBeGreaterThan(found.at(-1)!.size!.audioBytes);
  expect(PAGE_SIZE).toBe(30); expect(rows.slice(30)).toHaveLength(7);
});
describe('tamanhos apresentados', () => {
  it('distingue zero, unidades binárias e estimativa indisponível', () => {
    expect(formatBytes(0)).toBe('0 B'); expect(formatBytes(1024)).toBe('1 KiB'); expect(formatBytes(1024 ** 2)).toBe('1 MiB'); expect(formatBytes(NaN)).toBe('Indisponível');
  });
});
