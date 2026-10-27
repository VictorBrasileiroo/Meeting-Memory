import type { MeetingNotes, NotesOutput } from '../../src/domain/notes';
import type { Recording } from '../../src/storage/recordings';
export const analysisRecording = (count = 1): Recording => ({ id: 'recording', createdAt: 1000, startedAt: 1000, endedAt: 2000, durationMs: 1000, chunkCount: count, completeness: 'COMPLETE', interruption: null, profile: 'development', analysisModel: 'gemini-3.5-flash-lite', status: 'PROCESSING', revision: 1, retention: 'keep-local' });
// Synthetic source and expected extraction, never a real API response.
export const sourceText = 'Decidimos usar IndexedDB. Ana vai corrigir o bug até sexta. Talvez possamos mudar o tema.';
export const evidence = [{ chunkId: 'chunk-1', quote: 'Ana vai corrigir o bug até sexta.' }];
export const notesOutput = (): NotesOutput => ({ title: null, summary: [], sections: [{ kind: 'decisions', items: [{ text: 'Usar IndexedDB.', nature: 'established', evidence: [{ chunkId: 'chunk-1', quote: 'Decidimos usar IndexedDB.' }] }] }], tasks: [{ description: 'Corrigir o bug.', owner: 'Ana', deadline: 'sexta', status: 'defined', evidence }] });
export const emptyOutput = (): NotesOutput => ({ title: null, summary: [], sections: [], tasks: [] });
export const meetingNotes = (): MeetingNotes => ({ recordingId: 'recording', profile: 'development', analysisModel: 'gemini-3.5-flash-lite', schemaVersion: 1, promptVersion: 1, createdAt: 2000, sourceKey: 'test-source', output: notesOutput() });
