import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSnapshot, type Snapshot } from '../src/domain/contracts';
import { PopupApp } from '../src/popup/PopupApp';

const state = vi.hoisted(() => ({ snapshot: {} as Snapshot, loading: false }));
vi.mock('../src/components/useSnapshot', () => ({
  useSnapshot: () => ({ ...state, error: null, setSnapshot: vi.fn(), setError: vi.fn(), refresh: vi.fn() }),
}));
const render = () => renderToStaticMarkup(<PopupApp />);

describe('popup compacto', () => {
  beforeEach(() => {
    state.snapshot = initialSnapshot('mock');
    state.loading = false;
    vi.restoreAllMocks();
  });

  it('mostra status no cabeçalho e fontes previstas sem conteúdo editorial; simulação recolhida', () => {
    const html = render();
    expect(html).toContain('<label for="profile">Perfil</label>');
    expect(html).toContain('Reunião geral');
    expect(html.indexOf('Pronto para gravar')).toBeLessThan(html.indexOf('id="profile"'));
    expect(html.indexOf('Fontes de áudio')).toBeLessThan(html.indexOf('Iniciar gravação'));
    expect(html).toContain('Áudio da aba');
    expect(html).toContain('Microfone');
    expect(html).toContain('Sem medição de áudio');
    expect(html).not.toContain('audio-level-simulated');
    expect(html).toContain('Modo de desenvolvimento · simulação');
    expect(html).toContain('Áudio ainda não é capturado.');
    expect(html).toContain('<details class="popup-dev-tools">');
    expect(html).not.toContain('Guarde o que importa');
    expect(html).not.toContain('foundation-notice');
    expect(html).not.toContain('Conhecer a página da sessão');
  });

  it('mantém nome acessível do botão de configurações e ajuda da ação principal', () => {
    const html = render();
    expect(html).toContain('title="Configurações" aria-label="Configurações"');
    expect(html).toContain('aria-describedby="foundation-note"');
  });

  it('mostra tempo no rodapé e barras explicitamente ilustrativas na gravação simulada', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_200_000);
    state.snapshot = { ...state.snapshot, status: 'RECORDING', profile: 'research', startedAt: 78_000 };
    const html = render();
    expect(html).toContain('Gravando · simulação');
    expect(html).toContain('18:42');
    expect(html).toContain('Pesquisa');
    expect(html).toContain('Parar gravação');
    expect(html).toContain('Barras ilustrativas da simulação, sem medição de áudio');
    expect(html).toContain('Áudio ainda não é capturado.');
    expect(html).not.toContain('A gravação continua');
  });

  it.each([
    ['STARTING', 'Preparando simulação', 'Aguardando avanço da simulação'],
    ['STOPPING', 'Finalizando simulação', 'Aguardando avanço da simulação'],
    ['PROCESSING', 'Processando reunião', 'Ver detalhes'],
    ['COMPLETED', 'Notas prontas', 'Abrir resultado'],
  ] as const)('apresenta %s sem inventar contadores ou resultado', (status, label, action) => {
    state.snapshot = { ...state.snapshot, status, startedAt: 1_000, endedAt: 2_000 };
    const html = render();
    expect(html).toContain(label);
    expect(html).toContain(action);
    expect(html).not.toContain('partes concluídas');
    expect(html).not.toContain('class="timer"');
    expect(html).toContain('Áudio ainda não é capturado.');
  });

  it.each([
    ['processing', true, true, 'Tentar novamente'],
    ['processing', true, false, 'Reiniciar simulação'],
    ['processing', false, true, 'Reiniciar simulação'],
    ['capture', false, false, 'Reiniciar simulação'],
  ] as const)('oferece recuperação apenas com fase e material adequados (%s, %s, %s)', (phase, recoverable, hasRecoverableData, action) => {
    state.snapshot = { ...state.snapshot, status: 'ERROR', failure: { phase, recoverable, hasRecoverableData, message: 'Mensagem técnica longa que não pertence ao popup.' } };
    const html = render();
    expect(html).toContain(`>${action}</button>`);
    expect(html).toContain(`Falha ${phase === 'processing' ? 'no processamento' : 'na captura'} simulad`);
    expect(html).not.toContain('Mensagem técnica longa');
    if (action !== 'Tentar novamente') expect(html).not.toContain('Tentar novamente');
  });
});
