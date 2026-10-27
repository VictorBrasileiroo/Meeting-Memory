import { ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { FoundationNotice } from '../components/FoundationNotice';
import { DEFAULT_SETTINGS, loadSettings, restrictSettingsAccess, saveSettings, type AccessStatus, type Settings } from '../storage/settings';
import { isExtensionContext, openSession } from '../messaging/client';
import { ANALYSIS_MODEL_IDS, analysisModels, analysisModelSchema } from '../domain/analysis-models';

export function SettingsApp() {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [savedSettings, setSavedSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        if (!isExtensionContext()) { if (active) setError('Esta é uma prévia visual. Carregue a extensão no Edge para salvar configurações.'); return; }
        const status = await restrictSettingsAccess(chrome.storage.local);
        if (active) setAccess(status);
        const saved = await loadSettings(chrome.storage.local);
        if (active) { setSettings(saved); setSavedSettings(saved); }
      } catch (problem) {
        if (active) setError(problem instanceof Error ? problem.message : 'Não foi possível ler as configurações locais.');
      } finally { if (active) setLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      const saved = await saveSettings(chrome.storage.local, settings);
      setSettings(saved); setSavedSettings(saved); setVisible(false); setNotice('Configurações salvas neste perfil do navegador. A chave não foi testada.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  }
  return <main className="settings-app min-h-screen bg-paper">
    <header className="settings-masthead bg-ink text-white"><div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-5 min-[760px]:px-8"><Brand className="text-white [&_span_span]:text-muted-on-ink" /><div className="flex flex-wrap items-center gap-5"><a href="../library/library.html" className="text-sm text-muted-on-ink underline underline-offset-4 hover:text-white">Reuniões e armazenamento</a><Button variant="link" size="sm" className="px-0 text-muted-on-ink underline underline-offset-4 hover:text-white" onClick={openSession}>Ir para a sessão <span aria-hidden="true">↗</span></Button></div></div></header>
    <div className="mx-auto max-w-[1120px] px-5 pb-10 pt-10 min-[760px]:px-8 min-[760px]:pt-14">
    {__FOUNDATION_MOCK__ && <FoundationNotice />}
    <div className="mb-9"><h1 className="m-0 text-[44px] leading-[1.05] font-semibold tracking-[-.04em] [font-stretch:88%]">Configurações</h1><p className="mt-4 text-muted-foreground">Opções locais, salvas apenas quando você escolher.</p></div>
    <form onSubmit={(event) => void save(event)} aria-busy={loading || saving}>
      <div className="settings-panel"><section className="settings-row"><div><h2>Conexão com Gemini</h2><p className="muted">O áudio é enviado à Gemini API para transcrição; o texto é enviado para gerar notas. Salvar a chave retoma trabalhos que aguardam credenciais.</p></div><div>
        <div className="field"><label htmlFor="api-key">Gemini API Key</label><div className="key-field">
          <Input id="api-key" name="api-key" type={visible ? 'text' : 'password'} value={settings.apiKey} autoComplete="off" spellCheck={false} maxLength={256} disabled={loading || saving} aria-describedby="key-help" onChange={(event) => { setSettings({ ...settings, apiKey: event.target.value }); setNotice(null); }} />
          <Button variant="outline" type="button" aria-pressed={visible} disabled={loading} onClick={() => setVisible(!visible)}>{visible ? 'Esconder' : 'Mostrar'} chave</Button>
        </div><p id="key-help" className="field-help">Armazenada localmente. Quem tem acesso ao computador ou ao perfil pode recuperar essa chave.</p></div>
        <p id="test-key-help" className="field-help">Salvar não verifica a validade da chave. O primeiro envio real ocorre ao processar uma parte.</p>
        {access === 'restricted' && <p className="small success-text">Acesso ao armazenamento restrito a contextos confiáveis da extensão.</p>}
        {access === 'unsupported' && <p className="error-notice">Este navegador não oferece a restrição de acesso. A chave usa o armazenamento local comum.</p>}
        {access === 'failed' && <p className="error-notice" role="alert">A restrição de acesso local falhou. O salvamento está bloqueado; recarregue a extensão e tente novamente.</p>}
      </div></section>
      <section className="settings-row"><div><h2>Geração de notas</h2></div><div className="field"><label htmlFor="analysis-model">Modelo para gerar notas</label>
        <NativeSelect id="analysis-model" name="analysis-model" aria-describedby="model-help model-limits" autoComplete="off" value={settings.analysisModel} disabled={loading || saving} onChange={(event) => { setSettings({ ...settings, analysisModel: analysisModelSchema.parse(event.target.value) }); setNotice(null); }}>
          {ANALYSIS_MODEL_IDS.map((id) => <option key={id} value={id}>{analysisModels[id].label}</option>)}
        </NativeSelect><p id="model-help" className="field-help">Vale para as próximas sessões. Transcrição usa gemini-3.5-transcribe. Não há troca automática de modelo em caso de falha.</p>
        <p id="model-limits" className="field-help">Acesso e limites dependem do seu projeto. <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">Consultar limites no Google AI Studio</a></p>
      </div></section>
      <section className="settings-row"><div><h2>Idioma e áudio local</h2></div><div><div className="field"><label htmlFor="language">Idioma de transcrição</label><NativeSelect id="language" name="language" autoComplete="off" defaultValue={settings.language} disabled={loading || saving}><option value="pt-BR">Português brasileiro</option></NativeSelect><p className="field-help">Idioma inicial da V1.</p></div>
        <fieldset disabled={loading || saving}><legend>Depois de transcrever</legend>
          <label className="radio-option"><input type="radio" name="retention" value="delete-after-transcription" checked={settings.retention === 'delete-after-transcription'} onChange={() => { setSettings({ ...settings, retention: 'delete-after-transcription' }); setNotice(null); }} /><span><strong>Apagar áudio após transcrever</strong><small>O texto será preservado. Depois de apagar o áudio, não será possível ouvi-lo ou transcrevê-lo novamente.</small></span></label>
          <label className="radio-option"><input type="radio" name="retention" value="keep-local" checked={settings.retention === 'keep-local'} onChange={() => { setSettings({ ...settings, retention: 'keep-local' }); setNotice(null); }} /><span><strong>Manter gravação local</strong><small>Preservar áudio para revisão futura, usando espaço neste perfil.</small></span></label>
        </fieldset><p className="field-help">Áudio com falha será preservado. A exclusão automática só ocorre após salvar a transcrição e concluir a limpeza do arquivo remoto.</p>
      </div></section>
      <aside className="settings-row"><div><h2 className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-5" />Privacidade, com clareza</h2></div><div><p>Áudio e transcrição textual são enviados à Gemini API, respectivamente para transcrever e gerar notas. As chamadas usam store:false. O arquivo enviado é apagado após salvar a transcrição local. Isso não descreve toda a política de dados do provedor.</p><p>A chave fica neste perfil, sem sincronização. Quem controla o perfil pode recuperá-la.</p></div></aside></div>
      {error && <p className="error-notice" role="alert">{error}</p>}
      <div className="settings-save"><Button className="bg-ink hover:bg-ink-raised" type="submit" disabled={loading || saving || access === 'failed' || !isExtensionContext()}>{saving ? 'Salvando…' : 'Salvar configurações'}</Button><p role="status" aria-live="polite">{notice ?? (loading ? 'Lendo configurações…' : dirty ? 'Você tem alterações não salvas.' : 'Configurações locais carregadas.')}{(access === 'failed' || !isExtensionContext()) && <span className="block">Salvar está indisponível. Abra as configurações pela extensão.</span>}</p></div>
    </form>
    </div>
  </main>;
}
