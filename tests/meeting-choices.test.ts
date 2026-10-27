import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { createRecording, DB_NAME, openDatabase } from '../src/storage/recordings';
import { filterMeetingChoices, listMeetingChoices, meetingChoice, meetingLocation } from '../src/session/meeting-choices';
import { analysisRecording, meetingNotes } from './fixtures/notes';

beforeEach(async () => { await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); });

it('usa títulos salvos sem anunciar notas prontas apenas pelo status da gravação', () => {
  const recording = { ...analysisRecording(), status: 'COMPLETED' };
  const notes = meetingNotes(); notes.output.title = '  Revisão da recuperação  ';
  expect(meetingChoice(recording, notes).title).toBe('Revisão da recuperação');
  expect(meetingChoice(recording).status).toBe('Sem notas');
  expect(meetingChoice(recording, notes).status).toBe('Notas prontas');
  expect(meetingChoice({ ...recording, completeness: 'PARTIAL' }, notes).status).toBe('Interrompida');
});

it('busca sem acentos por título, perfil e data, combinando termos', () => {
  const recording = { ...analysisRecording(), createdAt: Date.parse('2026-10-18T12:00:00-03:00') };
  const notes = meetingNotes(); notes.output.title = 'Revisão da integração';
  const rows = [meetingChoice(recording, notes)];
  expect(filterMeetingChoices(rows, 'integracao revisao')).toEqual(rows);
  expect(filterMeetingChoices(rows, 'desenvolvimento 18/10')).toEqual(rows);
  expect(filterMeetingChoices(rows, 'outubro')).toEqual(rows);
  expect(filterMeetingChoices(rows, 'pesquisa')).toEqual([]);
  expect(filterMeetingChoices(rows, '   ')).toEqual(rows);
});

it('codifica IDs e conserva parâmetros da página, selecionando Notas para outra reunião', () => {
  const url = new URL(meetingLocation('https://local.test/session.html?keep=1&recordingId=old#audio', 'id /?#&'));
  expect(url.searchParams.get('recordingId')).toBe('id /?#&');
  expect(url.searchParams.get('keep')).toBe('1'); expect(url.hash).toBe('#notes');
  const preview = new URL(meetingLocation('https://local.test/session.html?scenario=completed', 'research', true));
  expect(preview.searchParams.get('scenario')).toBe('research'); expect(preview.searchParams.has('recordingId')).toBe(false);
});

it('lê apenas gravações e resultados em readonly, retorna metadados e ordena por data', async () => {
  await createRecording({ ...analysisRecording(), id: 'older', createdAt: 100 });
  await createRecording({ ...analysisRecording(), id: 'newer', createdAt: 200 });
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('results', 'readwrite');
    tx.objectStore('results').put({ ...meetingNotes(), recordingId: 'older', output: { ...meetingNotes().output, title: 'Título salvo' } });
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  }); db.close();
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
  try {
    const rows = await listMeetingChoices();
    expect(rows.map(row => row.id)).toEqual(['newer', 'older']);
    expect(rows[1]!.title).toBe('Título salvo');
    expect(rows[1]).not.toHaveProperty('output'); expect(rows[1]).not.toHaveProperty('transcripts');
    expect(transaction.mock.calls).toEqual([[['recordings', 'results'], 'readonly']]);
  } finally { transaction.mockRestore(); }
});

it('propaga falha de leitura, em vez de apresentar uma biblioteca vazia', async () => {
  const db = await openDatabase(); db.close();
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new Error('Leitura indisponível'); });
  try { await expect(listMeetingChoices()).rejects.toThrow('Leitura indisponível'); }
  finally { transaction.mockRestore(); }
});
