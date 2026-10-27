# UI v2 — Áudio × Papel

20/10/2026. Design aplicado à sessão, ao popup e às configurações. O pedido inicial foi ampliado pelo usuário, na conversa, para incluir as duas telas além do 6B.2. O pacote ZIP foi tratado como referência; suas alegações de autorização não substituíram a confirmação do usuário. Sem Git nesta pasta: preservação por hashes.

## Direção e implementação

**Tese visual:** navy identifica áudio e contexto; papel sustenta a leitura; amarelo identifica exclusivamente a fonte marcada. Tipografia e composição fazem a identidade, sem decoração promocional.

**Hierarquia:** popup = estado → perfil/fontes ou timer/waveform → ação; sessão = reunião/contexto/fita → abas/ações → documento/índice → detalhes; configurações = título → seções locais → salvar com feedback. Interações usam estados reais, foco previsível e movimento funcional com reduced motion.

- Fundação: tokens navy/papel/mint/marca-texto, Bricolage Grotesque e Source Serif 4 locais, fonte alternativa, licenças e subsets latin/latin-ext. Todos os arquivos de fonte abaixo de 150 KB; total 648.880 bytes. [Inventário e licenças](UI_LICENSES.md).
- Popup: perfis em quatro rádios **nativos**, que oferecem setas/teclado sem implementar ARIA manualmente. O select oculto sincronizado conserva compatibilidade; não recebe Tab. Estado gravando navy, timer principal tabular, buffer de 56 amostras por fonte desenhado em canvas a cada resposta LEVELS. Sem aleatoriedade em produção, sem atributo style para a waveform. O mock usa níveis determinísticos e rótulo explícito de simulação. Progresso usa processingStage; quando ausente, não há etapas fictícias. Ação principal de recuperação vem primeiro no DOM, seguida pelas ações já existentes. Largura nativa de 420px e altura pelo conteúdo; moldura achatada apenas na extensão.
- Sessão: topo navy com contexto real, fita informativa e partes de mesma largura. Abrir fonte destaca suas partes; ir à transcrição mantém esse destaque. Não há timestamps, durações inventadas ou leitura de Blobs para decorar a fita. Documento serifado até 680px, ícones por categoria, fontes literais marcadas, chips de responsável/prazo com dados existentes. Abas, histórico, seletor de reuniões, foco, cópia/exportação, áudio sob demanda e recuperação preservados.
- Configurações: painel branco com seções em duas colunas; uma coluna abaixo de 760px. Campo mascarado, mostrar/esconder, seleção de modelo e retenção mantidos; barra sticky com estado de alterações/salvamento e motivo quando indisponível. Aviso de saída com alterações pendentes; nenhuma mudança no módulo de armazenamento. Texto de privacidade completo mantido; aviso de simulação somente no mock. Fonte/tokens também conferidos nas páginas auxiliares de microfone/revisão.

Tailwind e componentes locais shadcn/Radix/Lucide continuam a base. Estilos específicos ficam em presentation.css, results.css e settings.css com a ordem compartilhada de camadas. O antigo popup.css fica preservado como histórico, sem ser importado. Sem nova dependência, rota funcional, biblioteca, chamada de teste de chave, checkbox de tarefa ou permissão.

## Inspeção visual e refinamento

Skills lidas: OpenAI frontend-skill e Vercel web-design-guidelines instaladas nos caminhos do AGENTS.md. A direção de aplicativos foi aplicada; hero, fotografia e motion decorativo não se aplicam a esta ferramenta. Os HTMLs do pacote foram traduzidos; seu runtime e seus atributos style não foram incorporados.

As capturas abaixo foram renderizadas em Edge headless e **abertas para inspeção**, incluindo folhas de contato dos estados. Não são imagens geradas. Perfil descartável, dados fictícios, transporte chrome de teste e CSP original; nenhuma chave, gravação ou API autenticada do usuário foi usada.

| Observação | Refinamento | Evidência |
| --- | --- | --- |
| Marca e controles perdiam contraste no navy por prioridade das utilities | Variantes explícitas de cor e hover; trocar reunião com contorno sobre navy | first-session-desktop → final-session-1280; first-popup-recording → delivery-recording |
| Ações de copiar/salvar herdavam o azul anterior | Botões ink com hover coerente; recuperação mantém azul funcional | refined-session-desktop; final-settings-1280 |
| Aviso de fixture criava uma faixa clara separando o topo do título | Integração do aviso à superfície navy no mock | first-session-desktop → final-session-1280 |
| Desenvolvimento cortava no cartão de perfil a 320px | Texto flexível com quebra íntegra, sem ocultar conteúdo | refined-popup-idle-320 → final-popup-idle-320 |
| Aba Áudio quebrava para outra linha a 320px | Menor gap e variantes compactas de texto/padding no limite estreito | inspected-reading-1 → final-session-320; geometria das três abas conferida |
| A ordem visual da recuperação precisava coincidir com Tab | Ação primária movida no DOM | final-popup-error-320 e checagem de ordem |

Arquivos em `.verification/ui-spec-v2/`: capturas first/refined/final, `inspected-popup-{320,420}-{1,2}.png`, `inspected-reading-1.png`, `inspected-settings-{1,2}.png`. Após o último ajuste foram abertas novamente final-session-320, final-session-evidence-mobile, final-settings-375 e o erro extenso a 320px. As primeiras fixtures de erro extenso excediam o contrato de 300 caracteres; foram corrigidas **somente no harness**, e as capturas finais confirmam o estado ERROR real.

Prévia de entrega: [sessão desktop](../.verification/ui-spec-v2/delivery-session-desktop.png), [gravando](../.verification/ui-spec-v2/delivery-recording.png), [sessão 320px](../.verification/ui-spec-v2/final-session-320.png), [configurações](../.verification/ui-spec-v2/final-settings-1280.png).

## Revisão Vercel

[Regras oficiais consultadas novamente nesta rodada](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Revisão de código, capturas e interações; não é uma auditoria completa de acessibilidade.

- `src/popup/PopupApp.tsx:113` — rádios com labels reais, foco no cartão, setas nativas e select de compatibilidade fora de Tab; nomes longos agora quebram a 320px.
- `src/popup/AudioWaveform.tsx:3` — canvas com nome acessível, leituras numéricas finitas limitadas a 0–1, memória limitada a 56 amostras; sem leituras de layout nem transição decorativa.
- `src/popup/presentation.css:44` — pulso/spinner têm override reduced motion; controles e disclosures com alvo de toque.
- `src/popup/PopupApp.tsx:143` — recuperação primária primeiro no DOM, preservando lógica de recuperabilidade e expectedRevision.
- `src/session/NotesContent.tsx:11` — disclosure nativo, citação literal em mark, parte identificada por chave existente; ícones decorativos escondidos de leitores.
- `src/session/NotesContent.tsx:66` — chips mantêm o texto acessível completo “Responsável: …” / “Prazo: …”; sem placeholders e sem duplicação de fala da inicial.
- `src/session/SessionResult.tsx:90` — fita informativa com descrição acessível; sem controles sem ação ou fonte temporal inventada.
- `src/session/SessionResult.tsx:96` — três abas em uma linha a 320px; foco e teclado Radix preservados.
- `src/settings/SettingsApp.tsx:38` — aviso de saída com alterações pendentes; handlers removidos no cleanup.
- `src/settings/SettingsApp.tsx:60` — chave com name/autocomplete/spellcheck e ajuda associada; máscara restaurada ao salvar.
- `src/settings/SettingsApp.tsx:69` — modelo com name e aria-describedby; valores/opções anteriores mantidos.
- `src/settings/SettingsApp.tsx:82` — feedback role=status, estado sujo/salvo e explicação quando salvar está bloqueado. Espaço/scroll-margin para barra sticky.
- `src/styles/fonts.css:1` — fontes locais com swap e faixas Unicode; sem CDN ou preconnect remoto.

Limites conservados: navegação para páginas da extensão usa os handlers chrome já existentes; não foi substituída por rotas novas. O carregamento da reunião conserva a mensagem textual existente em vez de adicionar um skeleton animado. Leitor de tela, zoom real e foco em alto contraste do sistema precisam de ensaio manual.

## Verificações e preservação

- Typecheck, lint e **248 testes em 28 arquivos aprovados**. Este era o conjunto existente nesta pasta, incluindo os cinco casos posteriores ao relatório histórico de 243 testes. **Nenhum arquivo de teste/fixture existente alterado**, nenhum nome acessível ou expectativa reescrito.
- Builds de produção e fixtures aprovados, com auditoria de 34/42 artefatos de código locais. Fontes e licenças também presentes no build. `dist` atualizado para a mesma instalação.
- `browser-checks.json`: **75 combinações responsivas** (320/375/640/1024/1440 × estados/abas), fontes por teclado, ida/volta com foco, histórico, cópia/exportação idênticas, áudio WAV sintético, liberação de URLs, recuperação mock e ID inválido. Zero exceções e zero requisições remotas. Este ensaio ocorreu antes do último ajuste compacto das abas; a geometria final foi conferida novamente em surface-checks.
- `surface-checks.json`: **24 combinações de popup**, cinco larguras de configurações e quatro larguras finais de sessão; estados, fase ausente, timer com horas, canvas alimentado por LEVELS mock constante, rádio com setas, nomes acessíveis, reduced motion, erro com 300 caracteres, máscara/salvamento de retenção, ausência de banner de fixture em produção, fita ativa e abas na mesma linha. Páginas auxiliares também abertas com fixtures. Zero exceções e zero requisições remotas.
- `contrast.json`: 14 pares aprovados nos alvos aplicáveis, incluindo fita apagada/navy 3,84:1, campo/branco 3,65:1, texto secundário/papel 6,26:1 e ink/marca-texto 13,37:1. Cálculo dos tokens, não auditoria de cada pixel renderizado.
- `preservation.json`: **100 de 115 arquivos anteriores intactos**, incluindo os **30 críticos**, **31 arquivos de testes/fixtures**, notes-export, dependências, build config e manifest. Só 14 arquivos de UI e AGENTS.md mudaram dentre o baseline. Novos arquivos de UI/fontes/licenças e documentação não entram nessa contagem.

### Limitação CSP preexistente, preservada

O perfil novo registrou bloqueios de `script-src` de uma **sondagem de eval do Zod**, embora a exceção seja capturada e as interações funcionem. Portanto os harnesses rígidos encerram com código 1 ao encontrar CSP; não foi declarado “zero violações de CSP”. Os eventos brutos estão nos JSONs, com classificação explícita e sem exclusão dos registros.

`zod-baseline.json` comprova que `zod-B_CUhVoG.js` atual é **byte a byte igual** ao bundle em `dist-dev.zip`, anterior a este trabalho (SHA-256 `d186ed4aeadd11bb5c0a8ab2523f78750cae5fddc718b31402dfcb85dd5016d8`). Nenhum evento novo de style-src/font-src, nenhuma requisição remota ou exceção de execução ocorreu. Não foram modificados Zod, dependências, arquitetura ou CSP para acomodar a revisão visual.

O Radix existente escreve `outline: none` no tabs-list e `animation-duration: 0s` no tabs-content por CSSOM. São os mesmos comportamentos da base, sem eventos style-src neste ensaio; o harness aceita apenas esses dois atributos conhecidos e rejeita outros estilos inline. A waveform e o novo markup não adicionam atributos style. Esse limite da base impede alegar “zero style em todo o DOM”.

## Reprodução e uso

1. `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run build:fixtures`.
2. Servir os builds pela CSP original: `node .verification/block-6b1/serve.mjs` (porta 5176).
3. Edge headless com `--disable-extensions --disable-sync --no-first-run --remote-debugging-port=9238` e user-data-dir descartável `.verification/ui-spec-v2/edge-clean`.
4. `node .verification/ui-spec-v2/inspect.mjs final` prepara browser.mjs; `prepare-checks.mjs` prepara o ensaio de regressão. Executar `check-results.mjs`, depois `check-surfaces.mjs`. O primeiro semeia o banco HTTP de teste. Ambos preservam eventos CSP brutos e retornam 1 para a limitação conhecida acima.
5. `finalize-evidence.mjs` classifica os eventos sem apagá-los; `preservation.mjs`, `contrast.mjs` e `prove-baseline.py` geram as evidências correspondentes. `contact-sheets.py` gera as folhas de inspeção a partir das capturas.

Para atualizar a extensão, encerrar captura/processamento e recarregar **a mesma entrada** em `edge://extensions`, apontando para `dist`. Não remover/reinstalar ou limpar dados. Não foi efetuada recarga da instalação do usuário. Permanecem manuais: popup nativo do Edge, Narrator, zoom real pelo menu, captura/mixagem, reprodução dos WebMs reais e processamento autenticado. Nenhuma dessas verificações foi alegada como feita.
