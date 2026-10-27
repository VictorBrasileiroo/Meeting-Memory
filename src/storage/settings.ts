import { z } from 'zod';
import { analysisModelSchema, DEFAULT_ANALYSIS_MODEL } from '../domain/analysis-models';

export const SETTINGS_KEY = 'settings-v1';
const legacySettingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  apiKey: z.string().trim().max(256).refine((key) => !/\s/.test(key), 'A chave não deve conter espaços.'),
  language: z.literal('pt-BR'),
  retention: z.enum(['delete-after-transcription', 'keep-local']),
});
const previousSettingsSchema = legacySettingsSchema.extend({ schemaVersion: z.literal(2), analysisModel: analysisModelSchema });
export const settingsSchema = previousSettingsSchema.extend({ schemaVersion: z.literal(3) });
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = { schemaVersion: 3, apiKey: '', language: 'pt-BR', retention: 'delete-after-transcription', analysisModel: DEFAULT_ANALYSIS_MODEL };
export type AccessStatus = 'restricted' | 'unsupported' | 'failed';
export type SettingsArea = Pick<chrome.storage.StorageArea, 'get' | 'set'> & {
  setAccessLevel?: (options: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
};

export async function restrictSettingsAccess(area: SettingsArea): Promise<AccessStatus> {
  if (typeof area.setAccessLevel !== 'function') return 'unsupported';
  try { await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }); return 'restricted'; }
  catch { return 'failed'; }
}
export async function loadSettings(area: SettingsArea): Promise<Settings> {
  let stored: unknown;
  try { stored = (await area.get(SETTINGS_KEY))[SETTINGS_KEY] as unknown; }
  catch { throw new Error('Não foi possível ler as configurações locais. Tente recarregar a página.'); }
  if (stored === undefined) return { ...DEFAULT_SETTINGS };
  const legacy = legacySettingsSchema.safeParse(stored);
  if (legacy.success) return saveSettings(area, { ...legacy.data, schemaVersion: 3, analysisModel: DEFAULT_ANALYSIS_MODEL });
  // Explicit user request: select Lite once for the existing installation.
  // Recording.analysisModel is frozen separately; existing sessions stay intact.
  const previous = previousSettingsSchema.safeParse(stored);
  if (previous.success) return saveSettings(area, { ...previous.data, schemaVersion: 3, analysisModel: DEFAULT_ANALYSIS_MODEL });
  const result = settingsSchema.safeParse(stored);
  if (!result.success) throw new Error('As configurações salvas não puderam ser lidas. Revise os campos e salve novamente.');
  return result.data;
}
export async function saveSettings(area: SettingsArea, input: unknown): Promise<Settings> {
  const result = settingsSchema.safeParse(input);
  if (!result.success) throw new Error('Revise a chave e as opções. Nenhum campo foi salvo.');
  const access = await restrictSettingsAccess(area);
  if (access === 'failed') throw new Error('Não foi possível restringir o acesso local. As configurações não foram salvas.');
  try { await area.set({ [SETTINGS_KEY]: result.data }); }
  catch { throw new Error('Não foi possível salvar as configurações locais. Tente novamente.'); }
  return result.data;
}
