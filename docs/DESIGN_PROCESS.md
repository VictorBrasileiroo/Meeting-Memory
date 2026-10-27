# Processo de design do Meeting Memory

20/10/2026: [UI v2 — Áudio × Papel](BLOCK_6B3_UI_REFINEMENT.md) aplicada à sessão, popup e configurações após autorização explícita na conversa. Tese, capturas desktop/celular abertas, refinamentos e revisão Vercel registrados nessa entrega. O conteúdo abaixo documenta as rodadas anteriores.

18/10/2026. Diretriz do usuário para o Bloco 6B.2 e revisões futuras de interface. O planejamento funcional permanece em [BLOCK_6A_PLAN.md](BLOCK_6A_PLAN.md).

Revisão visual posterior, após o pedido de melhorar o design: [composição atual e novas evidências](RESULTS_REDESIGN_2026-10-18.md). As capturas e verificações abaixo conservam o histórico da instalação das skills e da primeira rodada.

## Skills instaladas e procedência

| Skill | Fonte oficial | Instalação |
| --- | --- | --- |
| OpenAI frontend-skill | `openai/skills`, `skills/.curated/frontend-skill` | Revisão histórica oficial `30444aed500c00c85294d12074f6e3ee794f808a`, anterior à remoção; instalação local em `<CODEX_HOME>/skills/frontend-skill` |
| Vercel web-design-guidelines | `vercel-labs/agent-skills`, `skills/web-design-guidelines` | Branch `main`, instalação local em `<CODEX_HOME>/skills/web-design-guidelines` |

A instalação da frontend-skill na branch atual falhou com `Skill path not found`. O histórico oficial registra sua remoção no commit `11c643813b4645ca9f25d49ca180697732e0141a` (PR #370). Foi possível instalar o conteúdo original pelo commit pai, sem fork ou substituição por outra skill. Não se trata de uma versão atualmente mantida na branch principal. Ambas foram instaladas com o helper oficial `skill-installer`, fora das dependências do aplicativo.

Referências: [histórico da remoção](https://github.com/openai/skills/pull/370), [frontend-skill fixada](https://github.com/openai/skills/tree/30444aed500c00c85294d12074f6e3ee794f808a/skills/.curated/frontend-skill), [skill Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines), [diretrizes de revisão](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

## Aplicação ao produto

**Tese visual:** um caderno de trabalho digital, claro e silencioso, cuja identidade vem do símbolo próprio, da composição e da precisão tipográfica.

**Hierarquia:** marca e navegação utilitária → título e contexto da reunião → Notas / Transcrição / Áudio → ações junto ao conteúdo → documento contínuo → detalhes técnicos secundários. O título da reunião orienta o trabalho; não há hero ou CTA de marketing. Notas extensas continuam completas, com fontes e tarefas sustentadas pelo conteúdo original.

**Interações:** seleção de abas, disclosures de fontes e retorno com foco previsível. Hover e foco comunicam ação; não acrescentar motion ornamental. As sugestões da skill para imagens, marca dominante, heros e sequências animadas não se aplicam a esta superfície de trabalho e cedem às instruções explícitas do usuário.

**Identidade:** preservar a marca vetorial, Segoe UI local, azul funcional, branco/off-white e tokens existentes. Personalizar espaçamento, alinhamentos e níveis tipográficos antes de introduzir novos componentes. Tailwind, shadcn/ui e Lucide permanecem a base. Não importar fontes, imagens, bibliotecas ou permissões para satisfazer defaults das skills.

## Fluxo obrigatório

Direção → implementação → renderização real → inspeção das capturas → refinamento visual → nova renderização e inspeção → revisão Vercel → verificações de regressão. O checklist executável está em [AGENTS.md](../AGENTS.md).

O 6B.2 já tinha implementação nesta pasta quando este pedido chegou. Esta etapa revisa a base existente; não reinicia o motor, não inicia a biblioteca do 6B.3 e não usa o relatório anterior como prova de validação das novas alterações.

## Rodada aplicada e inspeção visual

A implementação empacotada foi renderizada no Edge headless com perfil isolado e a CSP original. O controle de navegador da sessão falhou com `windows sandbox failed: helper_unknown_error: setup refresh had errors`; foi usado o harness CDP já disponível no projeto, sem acessar a instalação da extensão.

Foram abertas e inspecionadas as capturas anteriores e posteriores ao refinamento. Observações e ajustes:

| Observação na captura | Refinamento realizado |
| --- | --- |
| Vazio desproporcional entre ações e resumo, especialmente no celular | Redução de 16px na reserva de feedback; região de status preservada e redução de 4px no intervalo entre título de seção e texto |
| Quebras de título desequilibradas | Largura máxima de 32ch e `text-wrap: balance`, mantendo tamanho, fonte e texto sustentado |
| Índice marginal pequeno no desktop | Links de 12px para 13px, mantendo numeração secundária e navegação por âncoras |
| Disclosures pequenos para toque | Alvos de pelo menos 44px em dispositivos com ponteiro coarse, incluindo os componentes locais; override na camada utilities para respeitar a cascata Tailwind |
| Acabamento da superfície | Raio alinhado ao token de 8px, mantendo documento único, sem sombras nem novos cards |

Também foram incluídos tema do navegador consistente, margens de safe area, resposta de toque e `name`/`autocomplete` do seletor. Não houve nova dependência, animação ou conteúdo de marketing.

Capturas realmente inspecionadas:

- Antes: [desktop](../.verification/design-process/before-notes-desktop.png) e [celular](../.verification/design-process/before-notes-mobile.png).
- Depois: [desktop](../.verification/design-process/final-notes-desktop.png), [celular](../.verification/design-process/final-notes-mobile.png), [toque 375px](../.verification/design-process/final-touch-375.png) e [reunião curta](../.verification/design-process/final-notes-short.png).
- Outras áreas: [fonte e transcrição](../.verification/design-process/transcript-source-desktop.png), [áudio](../.verification/design-process/audio-desktop.png) e [erro e recuperação](../.verification/design-process/error-desktop.png).

## Revisão Vercel e verificações

Diretrizes oficiais consultadas novamente após a implementação, em 18/10/2026. [Revisão por arquivo e localização](DESIGN_REVIEW_2026-10-18.md).

- Typecheck, lint e **243 testes em 27 arquivos** aprovados; nenhum teste anterior alterado.
- Builds normal e de fixtures com auditoria aprovados: 31 e 38 artefatos locais, respectivamente.
- **75 combinações responsivas** e interações aprovadas no Edge: abas/teclado, ida e retorno da fonte, histórico, cópia/exportação, player e URLs, recuperação mock, estados vazios/erros, forced colors e reduced motion. Execução final sem exceções, violações de CSP ou requisições remotas. [Resultado](../.verification/design-process/browser-checks.json).
- **15 controles de toque** avaliados com altura mínima de 44px a 375px, sem overflow. [Resultado](../.verification/design-process/touch-checks.json).
- **112 de 115 arquivos de baseline intactos**, incluindo os 30 críticos, os 30 arquivos de testes/fixtures e `notes-export.ts`. Só mudaram `src/session/results.css`, `src/session/session.html` e os atributos do seletor em `src/session/SessionApp.tsx`. Dependências, build config e manifest preservados. [Hashes](../.verification/design-process/preservation.json).

O primeiro ensaio completo registrou uma exceção genérica `Object` sem mensagem útil. O coletor foi ampliado para preservar `exceptionDetails` e a suíte foi repetida sem alteração do código do aplicativo; o registro não se reproduziu. A causa desse registro inicial não foi determinada. Os resultados finais acima correspondem à repetição, não à supressão do erro.

Os ensaios usam dados fictícios e transporte runtime de teste. Não constituem nova validação de captura/mixagem, Gemini autenticada ou WebM real. Narrator, zoom real pelo menu do navegador e smoke test na mesma instalação continuam manuais. Nenhuma chave ou gravação do usuário foi lida; não houve envio autenticado.

Para reproduzir: `npm.cmd run build`, `npm.cmd run build:fixtures`; iniciar `.verification/block-6b1/serve.mjs` na porta 5176 e Edge headless com perfil isolado e CDP na 9235; executar `.verification/design-process/inspect.mjs final`, `check-ui.mjs`, `touch-check.mjs` e `preservation.mjs`, nessa ordem. `inspect.mjs` prepara o adaptador a partir do harness anterior. Baseline e capturas anteriores foram preservados em `.verification/design-process/`; essa pasta é ignorada pelo Git e deve acompanhar o relatório se ele for compartilhado.
