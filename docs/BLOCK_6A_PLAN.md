# Meeting Memory — Bloco 6A: proposta de UX/UI

Atualização vigente 20/10/2026: o usuário pediu expressamente implementar **Reuniões e armazenamento**. Foram autorizados consulta de reuniões (6B.3) e gerenciamento manual (recorte do 6D), incluindo mudanças funcionais de persistência e mensagens descritas em [MEETING_MANAGEMENT.md](MEETING_MANAGEMENT.md). Esta autorização substitui os gates históricos abaixo. Não inclui cancelamento de processamento nem nova retenção automática.

Atualização 20/10/2026: o usuário autorizou explicitamente aplicar a UI v2 à sessão, ao popup e às configurações, apenas na apresentação do 6B.3. [Entrega, preservação e limites](BLOCK_6B3_UI_REFINEMENT.md). Esta atualização prevalece sobre os gates históricos de escopo abaixo; biblioteca e novas funcionalidades continuam fora do escopo.

Atualização 17/10/2026: o usuário autorizou e foi implementado exclusivamente o **6B.2 — resultados e leitura**. [Entrega e validação](BLOCK_6B2_RESULTS.md). O texto de autorização do 6B.1 abaixo permanece como histórico; o 6B.3 não foi iniciado.

17/10/2026 · Planejamento do Bloco 6, atualizado pela decisão explícita do usuário: **Tailwind CSS + shadcn/ui + Lucide React são a base oficial. O 6B.1 foi autorizado; demais sub-blocos aguardam validação.**

## 1. Escopo e evidência

O plano preserva captura, mixer, rotação A/B, parser, prompts, modelos, IndexedDB, permissões e retenção dos Blocos 1–5. Na entrega original 6A foram criados somente o plano, uma prévia e verificações. Depois o usuário autorizou a fundação [6B.1](BLOCK_6B1_FOUNDATION.md), sem novas funcionalidades. A prévia antiga continua fictícia e isolada.

Foram lidos PRODUCT_SPEC, ARCHITECTURE, DESIGN_SYSTEM, TEST_PLAN e DECISIONS, além de componentes, CSS, contratos, coordenador, worker, persistência, adapter Gemini, manifest, build e testes. Não há AGENTS.md no projeto. As referências antigas mencionadas no DESIGN_SYSTEM não estão anexadas nem disponíveis nesta conversa; **precisam ser reenviadas para avaliar fidelidade**. A direção clara deste pedido substitui a preferência histórica por popup charcoal, sujeita à aprovação visual.

Inspeção renderizada: popup, sessão e configurações atuais foram abertos pelo Vite em um Chrome de teste isolado. As capturas estão em `.verification/block-6a/`. Isso permite avaliar apresentação; os avisos de indisponibilidade da extensão nessa prévia HTTP são esperados, não são defeitos comprovados no Edge. A tentativa de inspeção no Edge não abriu o endpoint; nenhum ensaio real da extensão foi executado nesta etapa. Não lemos o banco nem a chave da instalação real.

O relato atual do usuário confirma captura, transcrição e geração de notas reais. Ele prevalece sobre parágrafos antigos que ainda dizem “primeira análise pendente”. Permanecem distintos os ensaios de falhas, lifecycle, quota, acessibilidade e duração não relatados como concluídos. Não extrapolar validação do fluxo principal para todos esses cenários.

Baseline nesta etapa: **223 testes em 25 arquivos passaram; typecheck aprovado**. Evidência de integridade dos arquivos funcionais: comparação SHA-256 antes/depois, registrada em `.verification/`. Não é prova de acessibilidade ou captura real.

Verificação final: lint também aprovado; **94 arquivos funcionais/configurações preservados por hash**. A prévia passou em navegação, busca, abertura de evidência/transcrição, confirmação de exclusão, alternância da chave fictícia e importação simulada; 25 combinações de largura (320/380/420/768/1024px) e tela não apresentaram overflow horizontal. Os 12 pares explícitos de contraste medidos passaram os alvos de texto/controle, sem equivaler a uma auditoria completa de acessibilidade. A inspeção local não conseguiu carregar o recurso de ícones do runtime; o monograma de fallback permaneceu visível, e os controles textuais continuaram utilizáveis. A prévia inline usa o Lucide fornecido pelo host. Resultados e capturas em `.verification/block-6a/`.

## 2. Diagnóstico da interface atual

| Achado confirmado | Consequência | Decisão proposta |
| --- | --- | --- |
| `popup.css` impõe dark e sobrescreve os tokens claros; páginas usam outra marca e outro ritmo | Parece haver dois produtos | Uma identidade clara compartilhada; preservar símbolo próprio e harmonizar marca |
| Sessão/configurações começam com aviso grande, eyebrow e título promocional de duas linhas | O conteúdo útil aparece tarde; configurações renderizadas ocuparam cerca de 2061px a 1200px de largura | Cabeçalhos utilitários, privacidade perto da decisão e ajuda contextual |
| Cada categoria de notas é um card; evidências repetem um rótulo longo | Leitura fica fragmentada e ações competem com texto | Documento contínuo, seções e divisores discretos; “Ver fonte” por item |
| Histórico é um select dentro de SessionApp | Pouca comparação e descoberta; sem busca, ordenação ou gestão | Biblioteca própria, com linhas de reuniões |
| SessionApp concentra histórico, recuperação, progresso e resultado | A hierarquia muda demais conforme estado | Biblioteca como entrada estável; sessão endereçável por ID |
| Popup mostra PROCESSING genérico apesar de existir processingStage | Falta distinguir transcrição de notas | Rótulo de fase e contagem real quando houver denominador conhecido |
| Perfil bloqueado para qualquer estado diferente de IDLE | Processamento ocupa o fluxo de nova captura | Separar seleção da próxima gravação do perfil imutável da sessão anterior |
| Erro de captura, cota, credencial e falha de notas aparecem em superfícies semelhantes | A ação de recuperação fica ambígua | Estado + consequência + ação específica, sem expor diagnóstico bruto |
| Idioma tem select com uma opção; “Testar chave” é mencionado em documentos mas não existe na UI atual | Controle sem escolha e expectativa incorreta | Mostrar “Português brasileiro” como informação; não inventar teste de chave |
| Áudio abre outra página de revisão; `Recording` não guarda título/origem/nome de arquivo | Resultado fragmentado; risco de preencher biblioteca com dados inventados | Integrar reprodução por parte; fallback de título e origem honesta |
| Não existem comandos de cancelamento/importação/exclusão | Um botão visual sozinho seria uma promessa falsa | Entregas técnicas isoladas e verificáveis antes de habilitar essas ações |

Base útil a preservar: notas primeiro, categorias vazias ocultas, evidências literais, rawText intacto, falantes locais por parte, cópia/exportação compartilhada, feedback anunciado, foco visível, reduced motion e retenção por sessão. O redesign deve aprofundar esses acertos.

## 3. Arquitetura de informação e navegação

```text
Popup → Iniciar / acompanhar / finalizar captura
      → Biblioteca
      → Resultado da sessão indicada
      → Configurações
      → Importar áudio → formulário em página completa [etapa posterior]

Biblioteca → Resultado por recordingId
           → Importação [posterior]
           → Armazenamento → confirmar ação destrutiva

Resultado → Notas | Transcrição | Áudio
          → Biblioteca (preservar busca/ordenação)
          → Configurações quando a falha exigir
```

Manter arquitetura multipágina do Vite; não introduzir roteador global. Adicionar entrada `src/library/library.html` após aprovação. Evoluir a página existente `src/session/session.html?recordingId=<id>`; abrir também URLs antigas sem ID com seleção/fallback atual. Importação pode ser rota local da biblioteca, sem nova permissão.

IDs inválidos ou sessão excluída mostram “Reunião não encontrada” com retorno à biblioteca; nunca abrir silenciosamente outra reunião no lugar. Biblioteca/configurações compartilham cabeçalho baixo com marca, Biblioteca e Configurações. Nada de sidebar permanente para duas opções. O resultado tem “Voltar à biblioteca”. Abrir uma página nunca inicia captura nem processamento novo por conta própria; a reconciliação existente continua respeitando políticas duráveis.

“Nova gravação” nas páginas completas orienta abrir a extensão na aba da reunião. Não iniciar captura da aba da própria biblioteca: o START atual consulta a aba ativa e exige gesto/permissão adequados.

### Popup

Largura candidata **380px**, avaliar 380 versus 420 no Edge; padding 20px, altura pelo conteúdo. Meta ociosa ~360–430px sem rolagem, inclusive com uma linha de processamento anterior. Não ocultar overflow. A prévia permite avaliar densidade; altura real depende do Edge, escala e texto.

- Cabeçalho: marca compacta, estado da captura e Configurações com nome acessível.
- Ocioso: “Nova gravação”, Perfil, fontes previstas em uma linha “Aba atual + microfone”, Iniciar gravação (primário), Importar áudio (secundário futuro), Biblioteca no rodapé. Fontes previstas não significam permissão concedida nem áudio medido.
- Preparando: manter dimensão dos controles; “Preparando gravação…”; bloquear repetir início. Permissão abre a página visível existente e orienta voltar à reunião.
- Gravando: timer em destaque moderado, perfil fixado em texto, duas fontes com medidores reais, “Você pode fechar este popup”, Finalizar gravação. Sem pausa, troca de fonte ou controles não implementados.
- Finalizando: “Salvando última parte…”; não liberar captura antes dos eventos finais e commits.
- Sem captura e com sessão anterior processando: mesma área de nova gravação + uma linha “Gerando notas · Ver detalhes”. Se houver várias, contagem e Biblioteca. Não listar todo o backlog.
- Cancelar processamento aparece junto à sessão anterior identificada, somente depois do suporte técnico; com captura ativa, a ação fica no resultado e explica que exige encerrá-la na primeira versão.
- Concluído: linha “Notas prontas · Abrir resultado”, sem ocupar toda a interface ou bloquear próxima gravação.
- Falha: mensagem curta por fase; ação “Configurar chave”, “Ver transcrição” ou “Tentar novamente” só quando elegível. Erros longos podem aumentar a altura; legibilidade prevalece sobre ausência de scroll.

### Biblioteca

Conteúdo até 1120px; título “Biblioteca” e Importar áudio secundário. Barra de busca com label e ordenação nativa: Mais recentes, Mais antigas, Título. Lista com título clicável, data, origem, perfil, status; duração e áudio disponível como informação secundária, se sustentados. Desktop usa colunas; a 320px cada reunião vira uma linha de duas ou três faixas, mantendo ações acessíveis sem hover.

Sem cards por reunião, gráficos de uso, métricas de produtividade ou filtros desnecessários. Busca inicial por título apresentado, perfil e data; não pesquisar transcrições completas a cada tecla. Debounce e carregamento paginado de metadados apenas se o volume justificar. A lista não deve carregar todos os Blobs/transcrições para mostrar títulos/status.

Título: `results.output.title` não vazio → fallback “<Perfil> · <data local>”. Não persistir um título inventado. `Recording` não tem título editável; renomear não faz parte desta entrega. Ordenação por título usa o título apresentado, com desempate por data/ID. Resultado vazio válido continua “Notas prontas”, com mensagem própria ao abrir.

Origem: novo campo opcional futuro identifica captura/importação. Legado sem esse campo aparece como **“Origem não registrada”**, sem inventar plataforma, URL ou nome da reunião. Não inferir “Teams” de um título de notas. Dados novos de captura usam “Aba + microfone”; importação usa “Arquivo de áudio”. Modelo/retention ausentes em legado têm explicação, sem preencher retroativamente nem iniciar análise.

Linhas têm Abrir e ações secundárias: copiar/exportar quando há notas; copiar transcrição se há texto; ouvir se há Blob não vazio. Em telas pequenas, oferecer essas ações dentro do resultado para evitar uma faixa de ícones. Exclusão fica em detalhes/ações identificadas por reunião, nunca no alvo principal da linha.

Estados: carregando, banco indisponível/bloqueado, biblioteca vazia, busca sem resultados, legado sem notas, capturando, processando, aguardando, interrompida, cancelada e concluída. Uma falha ao listar nunca deve ser apresentada como biblioteca vazia.

### Resultado da sessão

Cabeçalho compacto: título sustentado/fallback, data, duração quando conhecida, perfil e estado. Modelo efetivo e data da geração ficam em detalhes discretos; o override Lite existente continua visível. Ações Copiar notas e Exportar Markdown alinhadas ao conteúdo. Mostrar erro de clipboard/download no local da ação e anunciar sucesso sem deslocar o texto.

Navegação interna **Notas / Transcrição / Áudio**, com URL de fragmento para retornar à seção. Notas em uma coluna de **68–74ch**, corpo 16/26px. Resumo primeiro, depois categorias preenchidas e tarefas existentes, respeitando perfil/ordem semântica. Tarefas não ganham checkbox, dono ou prazo inventado. Sugestão e hipótese mantêm rótulo. Em página ampla, índice lateral discreto aparece apenas quando houver seções suficientes para ajudar; some em largura estreita. Sem painel obrigatório de métricas.

Cada item expõe “Ver fonte”: abre citação literal e link “Abrir na transcrição”. A ação abre a seção/parte correta, move foco para o trecho/bloco e preserva uma volta à nota. Sem offsets confiáveis, focar a parte e indicar a citação; não criar timestamp, seek exato ou falante global. Em conteúdo longo, usar `content-visibility`/renderização por partes somente após verificar âncoras, busca e leitor de tela; não esconder fonte por otimização prematura.

Transcrição: texto integral por parte; falantes somente quando presentes, parte + label; aviso de overlap e lacunas; Copiar transcrição próprio. Áudio: player nativo por parte selecionada, duração medida ou “aproximada” quando derivada do relógio, nenhuma waveform decorativa. Criar/revogar object URL conforme seleção/saída, sem carregar todos os Blobs ao abrir notas. Áudio removido mostra motivo conhecido e mantém texto/notas disponíveis.

Durante processamento, topo mostra fase e contagem; transcrição já salva continua consultável. Interrupção permanece explicitamente visível e no export relevante; não gerar notas parciais automaticamente. Diagnóstico técnico existente fica em details secundário, nunca como conteúdo principal nem com chamadas sintéticas disparadas ao abrir.

### Configurações

Título simples, seções separadas por espaço/divisores:

1. **Conexão Gemini:** campo mascarado, mostrar/ocultar, salvar explícito. “Salvar não testa a chave”; informar que salvar uma chave pode retomar trabalhos aguardando credenciais, respeitando cancelamento futuro. Preservar TRUSTED_CONTEXTS e bloqueio de gravação das preferências se sua aplicação falhar.
2. **Notas:** modelo nativo com rótulos atuais, Lite padrão, vale para próximas sessões; não alterar modelo das anteriores, não trocar automaticamente em falhas. Link explícito ao AI Studio.
3. **Áudio:** retenção em radio buttons, consequências junto à opção. Falhas/material pendente continuam protegidos. Idioma fixo apresentado em texto.
4. **Armazenamento:** estimativa da origem e link “Gerenciar na biblioteca”. Alterar retenção não é comando retroativo para apagar sessões.
5. **Privacidade:** texto curto sempre visível sobre áudio/texto enviados ao Google e chave recuperável no perfil; detalhes expandíveis para store:false e limpeza remota. Não chamar processamento de offline nem prometer retenção zero.

Salvar com estado loading/sucesso/erro, preservar valores em falha; se navegar com mudanças, aviso de descarte quando houver dados não salvos. Não acrescentar teste de conexão remoto nesta fase visual.

## 4. Direção visual, tokens e componentes

Direção recomendada: **clara, editorial e utilitária**. Espaço para ler, azul somente na ação/foco/seleção, status com texto e ícone; superfícies suaves com poucos contornos. Sem hero, gradientes, sombras em todas as seções ou grandes caixas coloridas. Manter fonte nativa Segoe UI/system-ui, assets empacotados e símbolo próprio; fonte nova não é necessária para melhorar tipografia.

| Token proposto | Valor | Uso |
| --- | --- | --- |
| background | `#F7F8FA` | Fundo externo |
| surface | `#FFFFFF` | Conteúdo e controles |
| text | `#182230` | Texto principal |
| text-muted | `#596579` | Metadados/ajuda |
| primary / hover | `#2453D4` / `#1C43AD` | Ação principal, links, foco |
| primary-soft | `#EDF2FF` | Seleção discreta |
| divider | `#E3E7ED` | Separação decorativa |
| control-border | `#7B8798` | Campo que depende de contorno |
| success / soft | `#176348` / `#EAF6F0` | Conclusão |
| warning / soft | `#855200` / `#FFF4DD` | Cota/atenção |
| danger / soft | `#B42332` / `#FDECEE` | Falha e ação destrutiva |

Texto principal/secundário e branco sobre primary devem atingir AA nas superfícies finais; borda decorativa não substitui contorno de controle. Medir contraste por par, inclusive hover, estados e foco; não tratar paleta como validada só por inspeção visual.

Escala: popup 14/20px; labels/metadados 13/18px; leitura 16/26px; seção 20/28px; título da página 28/34px; título do popup 20/26px; timer 32/38px tabular. Pesos 400, 500 e 600. Auxiliar nunca abaixo de 12px. Espaçamento 4/8/12/16/20/24/32/48; controles radius 8px, superfícies específicas 12px, badges pill. Altura principal 44px, demais ações 36–40px com alvo ampliado em touch. Foco 3px, offset 3px. Hover/pressed/loading/disabled explícitos; loading conserva largura e explica atividade. Transições de cor/opacidade em 120–160ms, reduzidas com `prefers-reduced-motion`; nenhum medidor fictício ou spinner como prova de progresso.

Componentes previstos: AppHeader, PageHeading, Button/IconButton, Field/Select, StatusLabel, InlineNotice, ProcessingSummary, MeetingRow, EmptyState, ReadingSection, EvidenceDisclosure, TranscriptPart, AudioPartPlayer, StorageSummary e ConfirmDialog. A base reutilizável é shadcn/ui, personalizada com Tailwind e tokens próprios. No 6B.1 entram Button, Input, Badge, Native Select, Tabs e AlertDialog. Select customizado, Dropdown Menu e outros entram quando seus fluxos exigirem, sem instalações especulativas. O seletor de perfil atual permanece nativo nesta fundação.

Acessibilidade: headings e landmarks corretos; labels persistentes; erros associados por `aria-describedby`; status com live region por mudança de fase, timer sem anúncio por segundo; teclado completo; dialogs com foco inicial em cancelar, Escape e retorno ao gatilho; tabs com setas/Home/End se adotarem padrão ARIA tabs (links de seção comuns também são opção). Evidências mantêm foco previsível. Testar contraste, 200%/400%, reflow a 320px, reduced motion, forced colors e Narrator no Edge. Não depender só de cor ou hover.

## 5. Bibliotecas, skills e CSP

**Decisão atual do usuário substitui a recomendação inicial de CSS próprio.** Tailwind é a solução principal de estilização; shadcn/ui fornece os componentes locais reutilizáveis e Lucide React padroniza a iconografia. React, Zod e SDK Gemini mantêm suas versões e contratos. Detalhes da implementação e evidências: [BLOCK_6B1_FOUNDATION.md](BLOCK_6B1_FOUNDATION.md).

| Opção | Avaliação | Recomendação |
| --- | --- | --- |
| CSS legado | Mantém páginas e fluxos durante migração incremental | Camada `legacy`, com aliases para a paleta oficial; não é a base dos novos componentes |
| Tailwind | CSS local, plugin Vite, tokens semânticos próprios | **Base oficial**, sem Preflight nesta etapa; utilitários na camada final |
| shadcn/ui | Componentes locais, adaptáveis e reutilizáveis | **Base oficial**; configuração manual suportada, só componentes necessários, sem importar tema genérico |
| Radix UI | Primitivas de foco, teclado e semântica para componentes shadcn | Slot, Tabs e AlertDialog; overlay adaptado à CSP com CSS estático, mantendo conteúdo modal Radix |
| Lucide React | SVGs locais e imports seletivos | **Iconografia oficial**; símbolo próprio preservado |
| Playwright + axe-core | Testa interação/viewport e regras automáticas; não prova mídia nem substitui Narrator | Dependências **somente de desenvolvimento**, após aprovação; Chrome pode testar layout, Edge real valida extensão |

Fontes oficiais: [Tailwind + Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn/Tailwind 4 e React 19](https://ui.shadcn.com/docs/tailwind-v4), [Radix AlertDialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog), [Lucide React](https://lucide.dev/guide/react). Recomendações são julgamento para este projeto, não garantias universais de compatibilidade.

A CSP atual inclui `script-src 'self'`, `style-src 'self'`, fontes locais, mídia `blob:` e conexão somente Gemini. **Não relaxar a CSP para acomodar UI.** Geradores de CSS devem emitir arquivo local. Verificar dependências que injetam `<style>`/estilos dinâmicos, portais, animações e posicionamento sob essa política; não declarar “Radix é compatível” apenas porque compila. Não usar CDN de fontes/ícones/scripts, eval ou HTML gerado pelo modelo.

Skills (atualização de 18/10/2026): por solicitação explícita do usuário, foram instaladas **OpenAI frontend-skill** (revisão histórica oficial fixada) e **Vercel web-design-guidelines**. A primeira orienta ativamente a composição e o acabamento; a segunda revisa UX, acessibilidade e implementação. Cada tela exige renderização no navegador, inspeção das capturas e ao menos uma rodada de refinamento baseada no resultado observado. [Procedência, aplicação e validação](DESIGN_PROCESS.md); regras persistentes em [AGENTS.md](../AGENTS.md). `visualize` foi usada na prévia anterior. `sites` não se aplica à extensão local. Não há necessidade de imagens ou motion decorativo nesta superfície. Nenhum subagente foi utilizado.

## 6. Estados reais e projeção de apresentação

Contratos executáveis atuais: snapshot `IDLE/STARTING/RECORDING/STOPPING/PROCESSING/COMPLETED/ERROR`; processingStage `transcribing/preparing/analyzing`; job `PENDING/PROCESSING/COMPLETE/ERROR/WAITING_FOR_CREDENTIALS`; erro `RETRYABLE/PERMANENT/USER_ACTION_REQUIRED`. Chunk usa `PENDING/COMPLETE/ERROR`. Não usar os nomes conceituais históricos RUNNING/SUCCEEDED como se existissem.

| Situação | Evidência necessária | Texto/ação |
| --- | --- | --- |
| Transcrevendo | Job de transcrição ativo; partes persistidas | “Transcrevendo · 2 de 3 partes”; durante captura “2 partes transcritas”, sem total final |
| Espera local | PENDING e nextAttemptAt futuro, sem causa persistida | “Aguardando próxima tentativa”; não afirmar cota se não houver evidência |
| Cota/limite local | Cooldown persistido do limitador ou 429 seguro associado | “Aguardando limite da API”; data/hora da próxima elegibilidade, sem promessa de execução pontual |
| Preparando | Fonte completa, sem job de análise em execução | “Preparando notas” |
| Gerando notas | ANALYZE_RECORDING em PROCESSING com lease válido | “Gerando notas”; sem percentual estimado |
| Falha temporária | RETRYABLE, budget disponível | Mensagem e próxima tentativa automática |
| Exige ação | WAITING_FOR_CREDENTIALS ou USER_ACTION_REQUIRED | “Configurar chave”/ação específica; não chamar toda falha de chave inválida |
| Permanente/esgotado | PERMANENT ou tentativas esgotadas | Fonte disponível; retry explícito somente quando o contrato permitir |
| Interrompida | interruption/completeness parcial | Aviso persistente; sem análise parcial automática |
| Concluída | Resultado persistido e validado | “Notas prontas”; limpeza remota pendente aparece separadamente |
| Cancelamento solicitado | **Novo controle durável futuro** | “Cancelando…” até confirmação/reconciliação |
| Cancelada | **Novo controle durável futuro** | “Processamento cancelado · dados preservados”; Retomar se houver fontes |

Criar uma projeção de sessão a partir de Recording + jobs + presença de resultado/transcripts; não inferir conclusão apenas de `Recording.status` string ou ausência de jobs. Erro de limpeza não transforma notas prontas em falha de conteúdo. A projeção exibe dimensões distintas quando necessário: “Gravação interrompida · transcrição preservada” ou “Notas prontas · limpeza pendente”.

Percentual de partes, se usado, representa transcrição e só tem denominador após captura encerrada; nunca 100% do processamento antes das notas. Não usar tempo estimado de IA ou progresso animado sem dado real.

## 7. Cancelamento seguro e captura durante análise anterior

### Separar responsabilidades sem trocar o motor

Hoje START aceita somente snapshot IDLE, RESET somente COMPLETED/ERROR e retry de análise salva bloqueia enquanto há captura. `activeSession` e snapshot ainda misturam seleção atual e bloqueio de captura. O executor já percorre gravações e aceita jobs de sessões diferentes, mas isso **não significa** que o fluxo completo de nova captura concorrente esteja suportado.

Proposta: snapshot passa a representar **captura ativa**, reservada somente em STARTING/RECORDING/STOPPING; processamento é estado durável por sessão. `lastViewed/lastFinished` é navegação, não mutex. A mudança é aditiva e limitada ao coordenador/persistência/projeção, com compatibilidade do snapshot existente e reconciliação após restart. Nunca liberar o mutex antes do STOP íntegro/commit. Garantir reserva transacional de uma captura no IDB; storage.local e IDB não têm transação conjunta, portanto prever falha entre escritas e recuperação, não alegar atomicidade entre ambos.

Manter **uma captura + um job de rede por vez**, usando a fila e rate limit atuais, sem segundo executor criado por página. Áudio B pode ser salvo enquanto notas A são geradas; o job longo A pode atrasar transcrição B — comunicar fila, não prometer processamento instantâneo. Inicialmente conservar seleção da fila; só mudar prioridade após evidência de starvation. Transcrição não pausa a captura.

Reutilizar o offscreen existente; verificar a criação para processamento com motivo WORKERS e transição para USER_MEDIA: a API define motivos na criação, não oferece adicionar motivo ao documento aberto. O spike deve provar o caminho aceito no Edge sem encerrar executor ativo nem perder lease. Se for preciso ajustar os motivos de criação para trabalho legítimo de captura futura, documentar a justificativa e retestar; **não assumir que ensureOffscreen() existente resolve o caso**. Não criar segundo offscreen.

Ponto crítico: `closeOffscreen()` hoje verifica jobs pendentes, mas não tem guarda própria de captura viva. Com múltiplas sessões, deve impedir fechamento enquanto qualquer captura estiver preparando/gravando/finalizando, mesmo que jobs A acabem ou B ainda não tenha produzido chunks. Eventos DRAINED de A não podem mudar snapshot de B. Fechamento só após reconciliar captura + todos os trabalhos necessários, em decisão serializada com START.

### Contrato de cancelamento proposto

Cancelar não é excluir, arquivar, resetar snapshot ou desligar o worker inteiro. Na primeira versão, permitir cancelar/retomar processamento de sessão encerrada; se essa sessão ainda captura, oferecer Finalizar gravação primeiro. O cancelamento é por recordingId e não afeta sessão B.

Preferir metadados de controle separados, opcionais e versionados (ex.: store aditivo `processingControls` numa futura migração v5), com `mode: RUNNING/CANCEL_REQUESTED/CANCELLED`, `epoch` e `revision`. Ausência significa comportamento histórico RUNNING. Não reutilizar erro permanente para representar cancelamento nem alterar rawText/resultados existentes. A estrutura final fica condicionada ao spike; é um contrato proposto, não código instalado.

1. Comando confiável `CANCEL_PROCESSING` inclui ID, requestId e revisão **da sessão/controle**, independente da captura B. Em transação, verificar sessão encerrada, resultado ainda não final, gravar pedido e invalidar geração dos jobs de conteúdo ativos. Repetição é idempotente.
2. `claimJob`, `reserveTranscription`, `enqueueAnalysis`, retries, `resumeCredentialJobs`, reconciliação e commits consultam o controle. Nenhum claim/novo envio de conteúdo após o pedido aceito; excluir DELETE_REMOTE_FILE desse bloqueio. Uma corrida entre verificação e envio externo continua possível, por isso a UX não promete retirada da requisição já enviada.
3. Executor recebe pedido direcionado e aborta somente o trabalho da sessão identificada, pelo AbortController apropriado. Não usar SHUTDOWN: encerraria a fila inteira. Distinguir cancelamento de falha de rede para não gerar retry automático via classificação atual de AbortError.
4. Commit de conteúdo revalida controle/epoch e lease. Se o resultado foi comprometido antes do cancelamento, ele permanece e o comando devolve “Resultado já concluído”. Se cancelamento venceu a transação, resposta tardia não produz notas/COMPLETED. Transcrições já salvas permanecem.
5. Upload que retorna identidade depois da invalidação deve enfileirar cleanup de órfão conhecido, reutilizando mecanismo existente; cleanup de arquivos conhecidos continua até após cancelamento. Resposta de upload perdida pode deixar órfão desconhecido: não prometer exclusão remota imediata ou custo evitado.
6. Mostrar CANCEL_REQUESTED até abort/ack ou lease expirado e reconciliação impedirem commit antigo. Cancelamento não depende de popup aberto. Durante esse intervalo não habilitar Retomar; evitar novo envio enquanto a chamada anterior ainda está localmente em atividade.
7. No cancelamento, proteger **áudio restante** contra liberação automática por cleanup, inclusive quando keep-local não foi escolhido, para manter a promessa de preservação. Áudio já removido pela retenção antes do pedido não pode ser recuperado; explicar a disponibilidade real. Texto/notas existentes nunca são apagados.
8. `RESUME_PROCESSING` explícito incrementa epoch/revisão, reabre os **mesmos IDs canônicos** de jobs elegíveis, conserva transcripts, sourceKey, modelo/override e janela de cota. Não criar jobs alternativos nem devolver reservas de API. Reiniciar budget somente por ação explícita e conforme política documentada. Reaplicar retenção segura somente depois de progresso válido; não usar retomada para limpar dados de imediato.

Interface: ação “Cancelar processamento” com ajuda “Os dados já salvos serão mantidos”; sem confirmação destrutiva porque não apaga. Exibir “Cancelando…” e depois “Cancelado”. Retomar informa envio à Gemini/possível cobrança e mantém o modelo escolhido. Cancelar sessão já concluída é no-op claro; excluir usa outro fluxo com confirmação.

## 8. Biblioteca, armazenamento e exclusão

`navigator.storage.estimate()` dá estimativa **da origem**, não bytes exatos por reunião, nem disco livre garantido. Mostrar “Uso estimado neste perfil”; se indisponível, estado explícito. Por sessão, somar tamanhos de áudio existentes, incluindo fragmentos quando atribuíveis; não usar `boundary.sizeBytes` ou `transcript.sourceSize` como ocupação atual, pois o Blob pode já estar vazio. Para escala, adicionar resumo de metadados mantido transacionalmente, com backfill incremental sem carregar toda a biblioteca na RAM. Inicialmente calcular sob demanda, fora da lista.

Áudio somente: permitido quando não há captura/lease de conteúdo usando o material, todas as transcrições correspondentes estão salvas e cleanup remoto relevante está concluído. Reutilizar/revalidar os invariantes de `releaseAudio`, mas criar comando explícito por sessão. Confirmar quantidade/tamanho estimado e “Você manterá notas e transcrição; não poderá ouvir nem retranscrever este áudio”. Não oferecer liberação fácil de partes pendentes/erro na primeira versão.

Sessão inteira: confirmar título e perda de notas/transcrição/áudio, sem “desfazer” fictício. Se ativa, desabilitar e orientar finalizar; se processando, exigir cancelamento confirmado primeiro. Marcar tombstone de exclusão antes de remover conteúdo para impedir que drain/reconciliação recriem jobs/notas. Invalidar leases e aguardar uso de Blobs terminar. Enfileirar/preservar jobs de cleanup com identidades remotas conhecidas **antes** de remover os registros de origem. Tombstone/controle mínimo e jobs de limpeza podem sobreviver temporariamente ao conteúdo excluído até o remoto ser limpo; não conservar transcrição/chave/nome de arquivo nesse registro técnico. Só compactar depois do cleanup ou estado terminal documentado, mantendo falha remota visível em armazenamento.

Exclusão local não promete apagar instantaneamente recursos Google nem sua política de retenção. Retry de cleanup não pode ressuscitar sessão. Falha/abort/quota durante exclusão mantém operação recuperável. Dialog mostra erro e não some como se tivesse concluído. Ações em lote só depois de operação individual robusta, com seleção explícita, prévia de espaço e confirmação. Sem limpar tudo automaticamente.

## 9. Viabilidade da importação de áudio — etapa posterior

**Viável reutilizar a fila e os adapters, mas não basta criar um Chunk com o arquivo escolhido.** `localChunkFailure()` hoje aceita somente WebM/Opus e usa fronteiras observadas do recorder quando não há duração medida. Um MP3/M4A/WAV não possui essas fronteiras; não preencher relógios fictícios, não renomear extensão/MIME para WebM e não usar File.lastModified como horário da reunião.

O [guia específico de Transcribe](https://ai.google.dev/gemini-api/docs/transcribe#supported-audio-formats) lista WAV, MP3/MPEG, M4A e WebM entre formatos aceitos. A [ficha do modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe) mantém limite de 30min com diarização. Suporte documental não comprova codec/contêiner ou MIME de cada arquivo real com SDK/Edge. Manter configuração verbatim/speaker, parser, validação de notas e motor existentes.

### Fluxo proposto

1. Popup/Biblioteca abre página completa. Usuário escolhe um arquivo local via input; `accept` é só auxílio, não validação. Antes de confirmar: **zero upload/API/job**. Nenhum nome/caminho local em log ou analytics.
2. Inspecionar cabeçalho/contêiner e codec quando identificável, MIME real, tamanho não zero, reprodução no Edge e duração finita verificada. File.type/extensão podem estar ausentes/errados; classificar por allowlist testada e resolver alias MIME explicitamente (ex.: audio/mpeg vs audio/mp3; M4A pode vir como audio/mp4). Sem duração confiável, rejeitar com instrução clara em V1.
3. Não decodificar um WAV/MP3 inteiro gigante só para descobrir duração: usar metadata via object URL + parser de contêiner testado; só aplicar decode com limite de recursos. Decode pode multiplicar memória; estabelecer e testar orçamento.
4. Primeira versão: **uma parte, até 29m30s** (alvo de produção atual, conservador e estritamente abaixo de 30min), e teto local proposto **100 MiB** sujeito ao spike de memória/IDB/upload. Isso é limite inicial do produto, não da Gemini. Informar ambos antes da escolha. Arquivo maior/mais longo é recusado com duração/tamanho medidos; nunca truncar nem dividir bytes de MP3/M4A.
5. Mostrar arquivo, duração, tamanho, perfil e retenção efetiva; nome é local e potencialmente sensível. Chamada “Importar e processar”, com aviso “Áudio e texto serão enviados à Gemini”. Permitir trocar arquivo/perfil e desistir antes do envio. Sem API key não iniciar rede; oferecer configurar ou salvar explicitamente para fila aguardando credenciais.
6. Consultar estimativa de armazenamento, considerar overhead e capturar QuotaExceededError real. Estimativa positiva não garante commit. Persistir sessão + Blob/parte + job de transcrição **na mesma transação**; não usar createRecording(), pois ela reserva activeSession. Se falhar, não deixar sessão/job órfão. Worker só pode reclamar após commit de confirmação. Evitar duas cópias duráveis do arquivo.
7. Enfileirar `transcribe:<chunkId>` na mesma fila. Fonte completa, encerrada e única; sem capturar microfone/aba nem ocupar mutex de captura. Respeitar serialização e rate limit. Ao obter texto, usar o mesmo enqueueAnalysis, análise e resultado.
8. Biblioteca identifica “Arquivo de áudio”; createdAt é data de importação. Hora original da conversa só se existir dado confiável explícito; nunca inferir do nome. Repetir confirmação da mesma operação usa ID de importação idempotente; mesmo arquivo selecionado em outra ocasião pode ser importado por decisão explícita, sem deduplicação por nome.

### Evolução mínima de contratos

- Recording ganha `origin?` discriminado; importação com metadados locais opcionais e data de importação. Registros antigos continuam legíveis sem backfill obrigatório.
- Fonte de Chunk deve distinguir capturada/importada, ou usar metadata própria por chunk; validação lê essa discriminação. Campos de boundary do recorder **não podem ser forjados** para satisfazer tipos. Projeção de análise/transcrição usa índice/duração/overlap real (zero para importação única) sem precisar conhecer recorderId fictício. Campo de origem ausente conserva validação WebM histórica.
- Separar validação de arquivo/fonte da validação específica do recorder; partes capturadas conservam exatamente os invariantes atuais. Adapter de upload já recebe Blob e MIME e transcrição usa MIME retornado; testar sem alterar o caminho WebM comprovado.
- result/profile/model/retention continuam fixados por sessão, prompt e schema inalterados. Importar não altera Settings, sessões antigas ou autoridade de captura.
- Persistência pode exigir migração aditiva de índice/metadata; nenhum reset do banco/origem. Gate de upgrade de v4 com sessões/transcripts/results e controles de cancelamento.

Falhas previstas: vazio, tipo forjado, arquivo corrompido, codec não reproduzível, duração Infinity/NaN, duração acima do limite, metadata mentirosa, byte limit, quota, leitura interrompida, tab fechada antes/depois do commit, cancelamento, credencial ausente, API rejeita formato. Antes do commit não há sessão; depois dele a recuperação usa a fila durável. URLs locais são revogadas ao trocar arquivo/sair. Não pedir permissão de captura para importar.

Arquivos longos ficam para investigação posterior: segmentação por decode/reencode ou demux/mux local preservando formato, offsets e evidências; memória/CPU e qualidade testadas. Não introduzir FFmpeg/WASM pesado, upload alternativo ou outro motor neste bloco. Ampliar duração requer decisão própria; não remover diarização silenciosamente para contornar o limite.

## 10. Implementação em blocos pequenos

Cada etapa termina com demonstração e critérios de aceite; alterações técnicas têm testes de invariantes e regressão. Não misturar importação com estabilização visual.

| Bloco | Escopo e arquivos prováveis | Aceite verificável |
| --- | --- | --- |
| **6A — agora** | Plano + prévia isolada | Avaliar identidade, hierarquia e fluxos; referências pendentes; nenhum código funcional alterado |
| **6B.1 — fundação visual autorizada** | Tailwind/Vite, shadcn/ui, Lucide React, tokens/global/legacy, Brand e controles base | Light consistente, CSS local, componentes personalizados, foco/contraste/CSP; sem alteração de chamada/contrato e sem Preflight global |
| **6B.2 — resultado** | SessionApp, NotesContent, OriginalTranscript, player integrado | Notas longas legíveis, categorias vazias ocultas, evidência leva à parte, copiar/export preservados; URL por ID e links antigos funcionam |
| **6B.3 — biblioteca de consulta** | library, entrypoint Vite, client/protocol allowlist | Listar/buscar/ordenar legado sem Blob eager, abrir ID correto, voltar preserva busca; sem mutações/exclusões |
| **6B.4 — popup e configurações** | PopupApp/CSS, SettingsApp | Popup ocioso sem scroll no Edge, gravação/STOP intactos; configurações compactas, chave mascarada e salva explicitamente; controles futuros ainda não expostos |
| **6B.5 — estabilização visual** | testes UI de desenvolvimento, fixtures e documentação | Edge real, 320/380/420px, zoom/teclado/Narrator; usuário avalia leitura e identidade antes das novas funções |
| **6C.1 — spike de concorrência** | somente harness/testes e decisão curta | Provar offscreen WORKERS→captura, reserva/reconciliação e fechamento seguro; sem prometer fluxo se teste falhar |
| **6C.2 — desacoplar captura/processamento** | coordenador, storage, snapshot/projeção/mensagens | A processa enquanto B grava; apenas uma captura/um executor; fim de A nunca fecha B; restart não troca IDs |
| **6C.3 — cancelar/retomar** | controle durável, policy/worker/commits, protocolo/UI | Corridas cancel/commit e restart passam; nenhum dado excluído; cleanup continua; retoma mesmos jobs sem perder modelo/cooldown |
| **6D.1 — espaço e áudio** | sumários de armazenamento, comando delete-audio, dialogs | Bytes aproximados honestos; remover só áudio elegível com confirmação; texto/notas intactos |
| **6D.2 — excluir sessões** | tombstone, cascata/cleanup e biblioteca | Sessão não ressuscita, jobs ativos protegidos, limpeza remota durável; falha recuperável; confirmação acessível |
| **6E.1 — spike de importação** | fixtures binárias e validador isolado | MP3/WAV/M4A/WebM reais curtos: MIME, codec, duração, memória, tamanho e SDK; definir formatos efetivamente liberados |
| **6E.2 — importar uma parte** | formulário/repository transacional/validação da fonte | Zero rede antes de confirmar; commit íntegro; pipeline único; legado/WebM mantidos; limites e quota tratados |
| **6F — regressão integrada** | testes/docs/auditorias | Fluxo principal Edge, A+B, cancel/restart, exclusão e importação após estabilização, sem permissões/CSP ampliadas |

Ordem recomendada: **visual de leitura e navegação primeiro**, depois concorrência/cancelamento, depois armazenamento/exclusão, importação por último. Os novos botões só são habilitados quando seus contratos passarem; a prévia mostra o destino desejado e não prova prontidão funcional.

Após aprovação de cada escopo, rodar checks existentes apropriados: typecheck, lint, Vitest, build normal/audit e chunk-test quando o caminho de captura/fila mudar. Não regravar/transcrever sessões antigas para testar UI. Registrar manual Edge separadamente, na mesma instalação/origem para validar compatibilidade de dados, sem remover extensão ou apagar banco.

## 11. Riscos de regressão e oráculos de teste

| Risco | Verificação necessária |
| --- | --- |
| Redesign interfere no START/STOP ou gesto | Reabrir popup durante preparação/gravação, fechar popup, duas fontes reais, finalização única, permissões negadas/revogadas; M-01–08 |
| Fim de análise A encerra captura B | Jobs A completam antes do primeiro chunk B, durante rotação e durante STOP B; guardas de offscreen e eventos por ID |
| Captura dupla ou snapshot antigo vence | Duas UIs, duplo START, revisão desatualizada, restart entre IDB/storage.local; uma reserva/stream |
| CANCEL só muda a tela | Cancelar pending/cooldown/upload/análise, fechar UI/reiniciar executor; nenhum claim de conteúdo posterior, nem commit de epoch antiga |
| Cancelamento apaga áudio via retenção | Cleanup termina depois do pedido; áudio restante protegido, texto igual; áudio removido anteriormente indicado honestamente |
| Resposta tardia/perda de upload | Cancelar junto ao commit e upload; cleanup de remoto conhecido criado; sem promessa sobre remoto desconhecido |
| Retomar duplica jobs/notas | CANCEL repetido, RESUME repetido, settings alterada, drain/reconcile concorrentes; IDs/resultados/fontes/modelos/cota preservados |
| Exclusão ressuscita sessão | Drain/worker tardio/restart após tombstone; nenhuma nota/job de conteúdo recriado, cleanup ainda encontra remoto |
| Migração perde sessões antigas | v1/v2/v3/v4 para versão futura, resultados prompt v1/v2, modelo/origem ausentes, áudio vazio, parcial/erro; mesma origem, sem reset |
| Interface mente sobre estado | Matriz da projeção, sem jobs, jobs de cleanup apenas, fonte parcial, legacy sem analysisModel, resultado vazio; conclusão só com resultado |
| Busca/lista pesa na memória | Centenas de metadados, Blob grande, banco bloqueado; não ler toda mídia/transcrição para listar |
| Cópia/export muda conteúdo | Comparar strings e Markdown anteriores com todos perfis, Unicode/HTML, sugestões, null, incompletude e evidências; sem chave |
| Evidência se perde em tabs/virtualização | Abrir fonte de nota em parte recolhida, foco/retorno, longo conteúdo, falantes ausentes e overlap preservados |
| Importação aceita falso WebM | MIME/extensão divergentes, M4A/MP3/WAV válidos/corruptos, duração inválida e limite, arquivo acima do teto; capturas WebM seguem mesma política |
| Importação envia antes de consentir | Interceptar rede e fila antes/depois da confirmação e fechar formulário; zero upload/job antes, atomicidade depois |
| Quota/abort deixa órfãos | Forçar falha em cada escrita/commit, cancelar seleção e sair; sem sessão/job incompleto nem Blob duplicado |
| Regressão visual/acessibilidade | Capturas por estado, 320/380/420/768/1200px, 200%/400%, foco, teclado/dialogs/Narrator, contrastes/forced colors, reduced motion; M-17–19 |
| Nova dependência viola CSP | Load unpacked real sem CSP errors, portais/estilos/ícones, audit-dist e diff de permissões; nenhuma fonte/script remoto |

Os 223 testes atuais permanecem como base; testes de markup não validam UI interativa. Testes novos devem provar comportamento nas fronteiras de persistência/concorrência, não replicar o código. Testes de rede usam transporte simulado; API real exige amostra curta consentida e observação de custo, separada da inspeção visual. Não precisa repetir todos os ensaios longos a cada ajuste CSS; repetir fronteiras/mídia quando houver mudança no coordenador/lifecycle ou evidência de regressão.

## 12. Decisões para avaliação e limite desta entrega

Direção: identidade clara compartilhada, navegação Biblioteca→Resultado, notas em documento contínuo e popup de controle, com **Tailwind CSS + shadcn/ui + Lucide React como base oficial**. A prévia 6A continua sendo exploração visual fictícia; a galeria 6B.1 usa os componentes React implementados e só entra no build de desenvolvimento. Importados, títulos, áudio, tamanho e datas da prévia antiga são exemplos fictícios.

Pendências antes da implementação: reenviar referências visuais para comparação, escolher densidade do popup, validar spike de offscreen/concorrência e confirmar os limites de importação após medir recursos. Ausência de referência não impede discutir esta proposta, mas impede declarar fidelidade às imagens anteriores.

**Após entregar a fundação 6B.1, parar para validação antes do 6B.2.** Esta autorização não inclui reformulação completa das páginas, concorrência, cancelamento, exclusão ou importação. Os gates técnicos permanecem obrigatórios.
