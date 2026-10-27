import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseTranscription } from '../src/gemini/transcription';
import { transcriptionStructure } from '../src/gemini/transcription-diagnostics';
import { speakerTurns } from '../src/gemini/speaker-turns';
import { TranscriptPart } from '../src/session/TranscriptPart';
import { claimJob, commitChunk, DB_NAME, getTranscript, persistTranscript, saveRemoteFile } from '../src/storage/recordings';
import { twoSpeakerResponse } from './fixtures/transcription-response';
import { makeChunk, makeTranscript } from './fixtures/recording';

beforeEach(async () => { await new Promise<void>((resolve, reject) => { const call = indexedDB.deleteDatabase(DB_NAME); call.onsuccess = () => resolve(); call.onerror = () => reject(call.error); }); });
const response = () => ({ ...twoSpeakerResponse, output_text: twoSpeakerResponse.steps[0]!.content[0]!.text });
describe('diarização por parte', () => {
  it('preserva dois IDs, texto integral e trechos sem speaker ou offsets', () => {
    const parsed = parseTranscription(response());
    expect(parsed.speakers).toEqual(['spk_1', 'spk_2']);
    expect(parsed.annotations).toEqual(twoSpeakerResponse.steps[0]!.content[0]!.annotations);
    expect(parsed.rawText).toBe('Bom dia. Vamos começar? Sim.');
    expect(speakerTurns(parsed.annotations)).toEqual([{ speaker: 'spk_1', text: 'Bom dia.' }, { speaker: null, text: 'Vamos começar?' }, { speaker: 'spk_2', text: 'Sim.' }]);
  });
  it.each([undefined, null, [], [null, {}, { content: null }, { content: [null, {}, { annotations: null }] }]])('tolera estrutura parcial %j sem inventar falantes', (steps) => {
    expect(parseTranscription({ output_text: 'Fonte.', steps })).toEqual({ rawText: 'Fonte.', speakers: [], annotations: [], interactionId: null });
  });
  it.each([null, [], 'texto', { output_text: 123 }, {}])('rejeita resposta inválida %j', (value) => {
    expect(() => parseTranscription(value)).toThrow();
  });
  it('dados produzidos pelo parser sobrevivem ao commit e reabertura IDB', async () => {
    await commitChunk(makeChunk()); const job = (await claimJob('A'))!;
    await saveRemoteFile(job.id, 'A', job.generation, { name: 'files/1', uri: 'https://file', mimeType: 'audio/webm' });
    const parsed = parseTranscription(response());
    const transcript = { ...makeTranscript(), ...parsed, metadata: { ...makeTranscript().metadata, interactionId: parsed.interactionId } };
    expect(await persistTranscript(job.id, 'A', job.generation, transcript)).toBe(true);
    expect(await getTranscript('chunk-1')).toEqual(transcript);
  });
  it('UI mantém rawText, escopo por parte e labels somente com speaker confiável', () => {
    const parsed = parseTranscription(response());
    const transcript = { ...makeTranscript(), ...parsed };
    const html = renderToStaticMarkup(createElement(TranscriptPart, { transcript }));
    expect(html).toContain(parsed.rawText);
    expect(html).toContain('Parte 1 · Falante 1'); expect(html).toContain('Parte 1 · Falante 2');
    expect(html).toContain('Falante não identificado');
    const other = renderToStaticMarkup(createElement(TranscriptPart, { transcript: { ...transcript, chunkIndex: 2 } }));
    expect(other).toContain('Parte 2 · Falante 1'); expect(other).not.toContain('Parte 1 ·');
    for (const annotations of [[], [{ type: 'word_info', text: 'Sem identidade.' }], [null, { speaker: 'spk_1' }]]) {
      const plain = renderToStaticMarkup(createElement(TranscriptPart, { transcript: { ...transcript, annotations } }));
      expect(plain).toContain(parsed.rawText); expect(plain).not.toContain('Trechos por falante');
    }
  });
  it('diagnóstico contém apenas estrutura, sem valores da reunião/credencial/headers', () => {
    const structure = transcriptionStructure({ ...response(), sdkHttpResponse: { headers: { authorization: 'secret-key' } }, input: [{ audio: 'secret-audio' }], output_text: 'secret-transcript' });
    expect(structure).toMatchObject({ stepCount: 1, contentCount: 1, annotationCount: 3, speakerCount: 2, hasInteractionId: true });
    const text = JSON.stringify(structure);
    for (const secret of ['secret-key', 'secret-audio', 'secret-transcript', 'Bom dia', 'spk_1', 'authorization']) expect(text).not.toContain(secret);
  });
});
