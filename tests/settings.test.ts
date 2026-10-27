import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, restrictSettingsAccess, saveSettings, settingsSchema, SETTINGS_KEY, type SettingsArea } from '../src/storage/settings';

function memoryArea() {
  const values: Record<string, unknown> = {};
  return {
    get: vi.fn(async () => ({ ...values })),
    set: vi.fn(async (input: Record<string, unknown>) => { Object.assign(values, input); }),
    setAccessLevel: vi.fn(async () => undefined),
    values,
  };
}
describe('settings', () => {
  it('seleciona Lite uma vez ao migrar v2, preserva chave/opções e respeita escolhas posteriores em v3', async () => {
    const area = memoryArea();
    area.values[SETTINGS_KEY] = { schemaVersion: 2, apiKey: 'test-only-key', analysisModel: 'gemini-3.6-flash', language: 'pt-BR', retention: 'keep-local' };
    const migrated = await loadSettings(area);
    expect(migrated).toEqual({ ...DEFAULT_SETTINGS, apiKey: 'test-only-key', retention: 'keep-local', analysisModel: 'gemini-3.5-flash-lite' });
    expect(area.set).toHaveBeenCalledOnce();
    await saveSettings(area, { ...migrated, analysisModel: 'gemini-3.8-flash' });
    expect((await loadSettings(area)).analysisModel).toBe('gemini-3.8-flash');
    expect(area.set).toHaveBeenCalledTimes(2);
  });
  it('usa defaults sem salvar automaticamente', async () => {
    const area = memoryArea();
    expect(await loadSettings(area)).toEqual(DEFAULT_SETTINGS);
    expect(area.set).not.toHaveBeenCalled();
  });
  it('salva explicitamente após restrição e recarrega de outro consumidor', async () => {
    const area = memoryArea();
    const settings = { ...DEFAULT_SETTINGS, apiKey: '  example-not-a-secret  ', retention: 'keep-local' };
    await saveSettings(area, settings);
    expect(area.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
    expect(await loadSettings(area)).toEqual({ ...settings, apiKey: 'example-not-a-secret' });
  });
  it.each([
    { ...DEFAULT_SETTINGS, retention: 'invalid' }, { ...DEFAULT_SETTINGS, language: 'pt' },
    { ...DEFAULT_SETTINGS, apiKey: 'has spaces' }, { ...DEFAULT_SETTINGS, unexpected: true },
  ])('rejeita opções inválidas sem escrita', async (settings) => {
    const area = memoryArea();
    expect(settingsSchema.safeParse(settings).success).toBe(false);
    await expect(saveSettings(area, settings)).rejects.toThrow('Nenhum campo foi salvo');
    expect(area.set).not.toHaveBeenCalled();
  });
  it('não descarta silenciosamente configurações inválidas persistidas', async () => {
    const area = memoryArea(); area.values[SETTINGS_KEY] = { invalid: true };
    await expect(loadSettings(area)).rejects.toThrow('configurações salvas');
    expect(area.set).not.toHaveBeenCalled();
  });
  it('reconhece API ausente sem anunciar restrição', async () => {
    const area: SettingsArea = { get: async () => ({}), set: async () => undefined };
    expect(await restrictSettingsAccess(area)).toBe('unsupported');
  });
  it('bloqueia escrita quando restrição falha e não inclui erro original', async () => {
    const area = memoryArea();
    area.setAccessLevel.mockRejectedValue(new Error('example-not-a-secret'));
    expect(await restrictSettingsAccess(area)).toBe('failed');
    await expect(saveSettings(area, DEFAULT_SETTINGS)).rejects.toThrow('não foram salvas');
    expect(area.set).not.toHaveBeenCalled();
  });
  it('sanitiza erros da leitura e escrita de settings', async () => {
    const area = memoryArea();
    area.get.mockRejectedValueOnce(new Error('example-not-a-secret'));
    await expect(loadSettings(area)).rejects.toThrow('Não foi possível ler');
    area.set.mockRejectedValueOnce(new Error('example-not-a-secret'));
    await expect(saveSettings(area, DEFAULT_SETTINGS)).rejects.toThrow('Não foi possível salvar');
  });
});
