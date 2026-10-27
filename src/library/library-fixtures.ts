import type { LibrarySource } from './library-source';
import type { ManagedMeeting } from '../storage/meeting-management';
import { meetingChoice } from '../session/meeting-choices';
import { profiles, PROFILE_IDS } from '../domain/profiles';

export function fixtureSource(): LibrarySource {
  const scenario = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('scenario');
  let conflictOnce = false;
  const sampleTitles = ['Planejamento do próximo ciclo', 'Revisão do fluxo de integração', 'Entrevistas e próximos experimentos', 'Decisões de arquitetura', 'Leitura e discussão de resultados', 'Alinhamento da equipe'];
  let rows: ManagedMeeting[] = Array.from({ length: 37 }, (_, i) => {
    const profile = PROFILE_IDS[i % 4]!; const title = sampleTitles[i % sampleTitles.length]!;
    const recording = { id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, profile, createdAt: new Date('2026-10-20T13:00:00Z').getTime() - i * 86400000, startedAt: 1000, endedAt: 31000, durationMs: 30000, status: i === 2 ? 'RECORDING' : i === 3 ? 'PROCESSING' : 'COMPLETED', revision: 1, chunkCount: 2, completeness: 'COMPLETE' as const, interruption: null };
    const choice = meetingChoice(recording);
    return { ...choice, title, profile: profiles[profile].label, status: i === 2 ? 'Gravando' : i === 3 ? 'Processando' : i === 5 ? 'Precisa de atenção' : i === 6 ? 'Sem notas' : 'Notas prontas', tone: i === 5 ? 'error' : i < 2 ? 'success' : 'neutral', recording, hasNotes: i !== 5 && i !== 6, transcriptCount: i === 2 ? 0 : 2, size: null, deleteReason: i === 2 || i === 3 ? 'Aguarde a gravação e o processamento terminarem.' : null, audioReason: 'Aguarde a medição do áudio.' };
  });
  if (scenario === 'empty') rows = [];
  if (scenario === 'long' && rows[0]) rows[0].title = 'Discussão de pesquisa e decisões com uma referência extensa ' + 'X'.repeat(220);
  const pause = () => new Promise<void>(resolve => setTimeout(resolve, 120));
  return {
    estimate: async () => ({ usage: rows.reduce((sum, row, i) => sum + (row.size ? row.size.audioBytes + row.size.textBytes + row.size.metadataBytes : (i % 4 === 0 ? 0 : (i + 1) * 2_470_000) + (i + 1) * 1300 + 1800), 0), quota: 2 * 1024 ** 3 }),
    list: async () => { await pause(); if (scenario === 'error') throw new Error('Falha fictícia de leitura'); return structuredClone(rows); },
    measure: async (input, progress, signal) => {
      await pause(); signal?.throwIfAborted(); progress(93);
      if (scenario === 'measure-error') throw new Error('Falha fictícia de medição');
      return { rows: input.map(row => {
        const i = rows.findIndex(item => item.id === row.id); const previous = rows[i]!;
        const audioBytes = previous.size?.audioBytes ?? (i % 4 === 0 ? 0 : (i + 1) * 2_470_000);
        const measured = { ...row, size: { audioBytes, fragmentBytes: 0, textBytes: (i + 1) * 1300, metadataBytes: 1800 }, audioReason: row.deleteReason ?? (audioBytes ? null : 'Não há áudio local para remover.') };
        if (i >= 0) rows[i] = measured; return measured;
      }), unassociatedAudioBytes: 0 };
    },
    mutate: async (id, type) => {
      await pause(); const row = rows.find(row => row.id === id); if (!row) throw new Error('A reunião fictícia já foi excluída.');
      if (scenario === 'conflict' && id.endsWith('000000000002') && !conflictOnce) { conflictOnce = true; throw new Error('O estado mudou durante a confirmação fictícia. Tente novamente.'); }
      const reason = type === 'DELETE_RECORDING' ? row.deleteReason : row.audioReason; if (reason) throw new Error(reason);
      const bytes = row.size?.audioBytes ?? 0;
      if (type === 'DELETE_RECORDING') rows = rows.filter(row => row.id !== id);
      else { row.size = { ...row.size!, audioBytes: 0, fragmentBytes: 0 }; row.audioReason = 'Não há áudio local para remover.'; }
      return { recordingId: id, type, removedAudioBytes: bytes, cleanupPending: false };
    },
    cleanup: async () => ({ pending: 0, failed: 0, waitingForCredentials: 0 }),
  };
}
