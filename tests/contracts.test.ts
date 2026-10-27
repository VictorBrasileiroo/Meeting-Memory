import { describe, expect, it } from 'vitest';
import { PROFILE_IDS, profiles, profileSchema } from '../src/domain/profiles';
import { initialSnapshot, snapshotSchema, visibleSections } from '../src/domain/contracts';
import { isTrustedPage, requestSchema, responseSchema } from '../src/messaging/protocol';

const id = '00000000-0000-4000-8000-000000000001';
const envelope = { protocolVersion: 1, requestId: id, target: 'background' };
describe('profiles and presentation contracts', () => {
  it('expõe os quatro perfis e labels esperados', () => {
    expect(PROFILE_IDS.map((profile) => profiles[profile].label)).toEqual(['Geral', 'Pesquisa', 'Desenvolvimento', 'Aula']);
    PROFILE_IDS.forEach((profile) => { expect(profileSchema.parse(profile)).toBe(profile); expect(profiles[profile].description.length).toBeGreaterThan(10); });
    expect(profileSchema.safeParse('unknown').success).toBe(false);
  });
  it('não renderiza seções vazias nem whitespace, sem modificar fonte', () => {
    const source = [{ id: 'empty', title: 'Sem dados', items: [] }, { id: 'blank', title: 'Vazia', items: ['  '] }, { id: 'decisions', title: 'Decisões', items: ['Definir escopo.', ''] }];
    expect(visibleSections(source)).toEqual([{ id: 'decisions', title: 'Decisões', items: ['Definir escopo.'] }]);
    expect(source[2]?.items).toHaveLength(2);
  });
  it('rejeita inconsistência e credencial no snapshot', () => {
    expect(snapshotSchema.safeParse(initialSnapshot()).success).toBe(true);
    expect(snapshotSchema.safeParse({ ...initialSnapshot(), apiKey: 'example-not-a-secret' }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...initialSnapshot('mock'), status: 'RECORDING', recordingId: id }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...initialSnapshot('mock'), status: 'ERROR', recordingId: id }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...initialSnapshot('mock'), status: 'ERROR', recordingId: id,
      failure: { phase: 'processing', message: 'Falha', recoverable: true, hasRecoverableData: true } }).success).toBe(false);
  });
});
describe('message boundaries', () => {
  it('troca explícita de modelo no retry aceita somente Lite, sem alterar o comando de probe', () => {
    const retry = { ...envelope, type: 'RETRY_ANALYSIS', recordingId: id, expectedRevision: 0 };
    expect(requestSchema.safeParse({ ...retry, analysisModel: 'gemini-3.5-flash-lite' }).success).toBe(true);
    expect(requestSchema.safeParse(retry).success).toBe(true);
    for (const analysisModel of ['gemini-3.6-flash', 'attacker-model', null]) expect(requestSchema.safeParse({ ...retry, analysisModel }).success).toBe(false);
    expect(requestSchema.safeParse({ ...retry, type: 'PROBE_ANALYSIS', analysisModel: 'gemini-3.5-flash-lite' }).success).toBe(false);
  });
  it('aceita consulta versionada e START mock tipado', () => {
    expect(requestSchema.safeParse({ ...envelope, type: 'GET_SNAPSHOT' }).success).toBe(true);
    expect(requestSchema.safeParse({ ...envelope, type: 'START_MOCK', recordingId: null, expectedRevision: 0, payload: { profile: 'research' } }).success).toBe(true);
  });
  it.each([
    { ...envelope, protocolVersion: 2, type: 'GET_SNAPSHOT' },
    { ...envelope, target: 'offscreen', type: 'GET_SNAPSHOT' },
    { ...envelope, type: 'START_MOCK', recordingId: null, expectedRevision: -1, payload: { profile: 'research' } },
    { ...envelope, type: 'STOP_MOCK' },
    { ...envelope, type: 'START_MOCK', recordingId: null, expectedRevision: 0, payload: { profile: 'invalid' } },
    { ...envelope, type: 'GET_SNAPSHOT', apiKey: 'example-not-a-secret' },
  ])('rejeita envelope inválido', (request) => { expect(requestSchema.safeParse(request).success).toBe(false); });
  it('valida resposta e não permite chave extra', () => {
    const response = { protocolVersion: 1, requestId: id, ok: true, snapshot: initialSnapshot() };
    expect(responseSchema.safeParse(response).success).toBe(true);
    expect(responseSchema.safeParse({ ...response, apiKey: 'example-not-a-secret' }).success).toBe(false);
  });
  it('só confia nas páginas internas conhecidas', () => {
    expect(isTrustedPage({ id: 'abc', url: 'chrome-extension://abc/src/popup/popup.html' }, 'abc')).toBe(true);
    for (const sender of [
      { id: 'other', url: 'chrome-extension://abc/src/popup/popup.html' },
      { id: 'abc', url: 'https://example.org/src/popup/popup.html' },
      { id: 'abc', url: 'chrome-extension://abc/untrusted.html' },
      { id: 'abc', url: undefined },
    ]) expect(isTrustedPage(sender, 'abc')).toBe(false);
  });
});
