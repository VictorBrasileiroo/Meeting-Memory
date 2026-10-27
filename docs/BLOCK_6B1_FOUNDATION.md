# Meeting Memory — Bloco 6B.1: fundação visual

17/10/2026 · Tailwind CSS + shadcn/ui + Lucide React. **Parar para validação antes do 6B.2.**

## Entrega

Fundação com identidade clara própria: fundo #F7F8FA, branco #FFFFFF, texto #182230, secundário #596579 e azul #2453D4. Segoe UI/system-ui local, controles de 44px, radius de 8px e foco de 3px. A marca mantém o símbolo vetorial original, com wordmark compartilhado. Não foi aplicado o tema padrão completo do shadcn.

Popup e configurações receberam os primeiros controles compartilhados. Sessão e páginas auxiliares herdam tokens e marca; sua estrutura não foi redesenhada. Não há biblioteca nova, importação, exclusão, cancelamento ou concorrência implementados.

## Dependências fixadas

| Dependência | Versão | Papel |
| --- | --- | --- |
| tailwindcss / @tailwindcss/vite | 4.3.3 / 4.3.3 | CSS local e plugin Vite; devDependencies |
| lucide-react | 1.59.0 | Ícones SVG por imports seletivos |
| @radix-ui/react-slot | 1.5.0 | Composição asChild |
| @radix-ui/react-tabs | 1.2.1 | Semântica e teclado das abas |
| @radix-ui/react-alert-dialog | 1.2.1 | Conteúdo modal, foco e Escape |
| class-variance-authority | 0.7.1 | Variantes tipadas |
| clsx / tailwind-merge | 2.1.1 / 3.7.0 | Composição e resolução de classes |

React/React DOM 19.3.0, Zod 4.6.5, SDK Gemini 2.24.0, Vite e TypeScript mantêm suas versões. shadcn/ui é código local de componentes, com configuração manual suportada em `components.json` e alias `@/*` em TypeScript/Vite/Vitest; não é um pacote runtime adicional. Não foi executado um init que sobrescrevesse a aplicação.

Base/proveniência: [shadcn em Vite](https://ui.shadcn.com/docs/installation/vite), [registro Button](https://ui.shadcn.com/r/styles/new-york/button.json), [Radix AlertDialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog), [Tailwind sem Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight), [Lucide React](https://lucide.dev/guide/react). Padrões shadcn adaptados à identidade e plataforma; licença MIT preservada em [UI_LICENSES.md](UI_LICENSES.md). As dependências conservam suas próprias licenças nos pacotes.

## Componentes e migração

- **Button:** variantes primary, secondary, outline, ghost, link, destructive e destructive-outline; tamanhos normal, compacto e ícone, foco/disabled/reduced motion. Default type=button evita submit acidental; submit explícito e links asChild preservados.
- **Input:** semântica nativa e atributos de máscara, formulário, ref e acessibilidade encaminhados.
- **Badge:** cores funcionais e rótulos; o significado nunca depende só da cor.
- **NativeSelect:** padrão shadcn Native Select com Lucide. Mantém value, onChange, disabled e options existentes. Select customizado e Dropdown Menu ficam para quando houver fluxo que os exija.
- **Tabs:** Radix com seleção azul e setas por teclado; exercitado na galeria, sem migrar a navegação da sessão antes do 6B.2.
- **AlertDialog:** primitivas Radix com estilo próprio; exercitado na galeria, sem adicionar exclusão real.

`global.css` declara a ordem **theme → legacy → base → components → utilities**. Tema e utilitários Tailwind são importados separadamente; **Preflight não é importado**. O global anterior foi preservado em `legacy.css`, retirando apenas seu import de tokens, agora centralizado. O popup também importa seu CSS na camada legacy, por `popup-entry.css`, e deixou de sobrescrever a paleta com charcoal.

Aliases `--color-*` mantêm os estilos antigos na mesma paleta. Novos componentes usam utilitários Tailwind e variantes locais shadcn, que prevalecem sobre legacy. CSS próprio fica restrito a tokens, compatibilidade, identidade e adaptações de plataforma/CSP. Nos próximos blocos, migrar um grupo por vez e retirar suas regras legacy após verificar a página. Não ativar Preflight sem regressão própria de formulários, tipografia, popup e áudio.

## MV3 e CSP

Manifest, permissões e CSP estão **byte a byte preservados**. Scripts, CSS e SVGs locais; sem CDN, fonte remota, unsafe-inline, unsafe-eval, nonce ou host adicional.

O Overlay padrão Radix envolve RemoveScroll, que injeta um style dinâmico. A variante local conserva **AlertDialog.Content** e usa backdrop estático dentro do Portal, com scroll lock por CSS `:has()` empacotado. Foco inicial em cancelar, foco preso ao modal, título/descrição, ocultação do conteúdo externo para leitores de tela, Escape e retorno ao gatilho continuam no Radix. Não há patch de node_modules nem desligamento da modalidade.

Foi observado também o probe de eval do Zod já presente no bundle anterior. `ui-csp.ts` ativa o modo interpretado oficial **jitless somente no bootstrap visual**, sem mudar schemas ou regras. O executor/offscreen/service worker não importam esse bootstrap. Chunks separados de Zod e React impedem a inicialização antecipada de schemas por fusão de módulos. Isso altera carregamento do bundle, não o motor de processamento.

O auditor passou a usar AST para imports reais: o regex antigo confundia strings “from” do tailwind-merge com imports externos. Imports ainda devem ser relativos/existentes; imports dinâmicos não literais são rejeitados. As demais proteções continuam, e a galeria/texto de exemplo passou a ser proibida no dist normal.

## Arquivos

**Configuração:** package.json, package-lock.json, components.json, vite.config.ts, tsconfig.json, vitest.config.ts.

**Novos:** `src/components/ui/{button,input,badge,native-select,tabs,alert-dialog}.tsx`, `src/lib/{utils,ui-csp}.ts`, `src/styles/{legacy,foundation}.css`, `src/popup/popup-entry.css`, `src/design-preview/{design-preview.html,main.tsx}`, `tests/ui-foundation.test.tsx`.

**Alterados:** Brand.tsx; PopupApp.tsx, main.tsx e popup.css; SettingsApp.tsx e main.tsx; session/main.tsx; review/review.ts (só import de bootstrap visual); styles/global.css e tokens.css; scripts/audit-dist.mjs. SessionApp.tsx e NotesContent.tsx continuam intactos.

**Documentação/artefatos:** plano 6A, design system, DEC-029, arquitetura, especificação, testes, README e este relatório/licenças. Dist normal e dist-dev regenerados. Capturas/harness em `.verification/block-6b1/`. Não há Git nesta pasta: a comparação usa SHA-256 e AST, sem commit ou alegação de diff Git.

## Validação e limites

- Typecheck e lint aprovados; **228 testes em 26 arquivos**, incluindo todas as 25 suítes anteriores. Novos testes: submit/composição, máscara/atributos, select nativo e contrato existente em jitless.
- Build normal/auditoria e build de fixtures executados. Galeria ausente do dist normal e presente somente no dist-dev.
- SHA-256: **30 arquivos do núcleo/manifest inalterados** (background, captura, domínio, Gemini, mensagens, offscreen, fila e storage). AST: lógica anterior ao render e todos os event handlers de PopupApp/SettingsApp iguais ao baseline. Os testes anteriores não foram reescritos para aceitar comportamento novo.
- Nove pares explícitos de contraste medidos passaram os alvos AA de texto/contorno, incluindo azul primário, texto secundário, badges funcionais e borda de input; valores em `preservation.json`. Isso não substitui uma auditoria completa de acessibilidade das páginas futuras.
- Edge **155.0.4283.45 headless**, com arquivos empacotados servidos por HTTP sob a CSP original: modal, foco, Tab/Shift+Tab/Escape, abas, máscara, transições mock existentes e 20 combinações de largura/superfície. **Zero violações de CSP, zero exceções de execução e zero requisições remotas** nas páginas testadas, inclusive popup normal após a configuração de carregamento. Resultado final em `browser-checks.json`; hashes/AST em `preservation.json`; capturas na mesma pasta.

Isso não equivale a captura real ou instalação Load unpacked. Restam validação visual pelo usuário, Narrator, forced colors, zoom real e smoke test na **mesma instalação** do Edge, sem apagar dados ou recarregar durante captura. Nenhuma chave/banco da instalação real foi lido e nenhuma chamada autenticada foi executada.

Próximo passo após validação: **6B.2 — resultado e leitura**, usando esta base. Biblioteca e novas funções permanecem nos seus sub-blocos.
