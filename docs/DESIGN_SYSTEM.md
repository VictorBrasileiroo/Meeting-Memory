# Meeting Memory — sistema de design

## Reuniões e armazenamento — extensão autorizada em 20/10/2026

Biblioteca funcional autorizada depois da UI v2. Tese: um índice de documentos no papel, com navegação navy e armazenamento como informação de apoio. Hierarquia: título, resumo discreto, busca/filtros, seleção e lista contínua; sem cartões por reunião. Cada linha mantém título, data, perfil, estado, conteúdo disponível e tamanho estimado. Ações destrutivas abrem confirmação com motivos de proteção e resultados individuais.

Desktop mantém resumo e filtros abertos; celular usa disclosures nativos para aproximar a lista do início. Linhas reorganizam em duas colunas, sem truncar títulos. Controles de toque têm 44px, seleção da página indica estado parcial, diálogo inicia em Voltar e devolve foco ao gatilho ou ao título se a linha foi excluída. Busca/filtros/ordenação/página são preservados na URL e no retorno da sessão. [Refinamentos e capturas](MEETING_MANAGEMENT.md).

Processo vigente desde 18/10/2026: [direção de produto com frontend-skill, revisão Vercel e refinamento obrigatório após inspeção no navegador](DESIGN_PROCESS.md).

## Direção vigente — Áudio × Papel (20/10/2026)

O usuário autorizou explicitamente aplicar o pacote UI spec v2 também ao popup e às configurações, somente na apresentação. Esta seção substitui as restrições históricas de paleta, tipografia nativa e escopo 6B.2 abaixo. A autorização posterior da biblioteca está registrada acima. [Entrega e evidências](BLOCK_6B3_UI_REFINEMENT.md).

Navy `#0E1A3A` identifica áudio e cabeçalhos; papel `#F4F6FB` sustenta texto; branco delimita campos e fontes. Azul `#2453D4` e símbolo original preservados. Amarelo `#FFE27A`/`#FFDD55` é exclusivo de fonte marcada. Texto secundário `#4F5B78` no claro e `#A9B6D6` no navy. Campos mantêm borda `#7B8798`; fita apagada `#5873C9` supera 3:1 sobre navy.

Bricolage Grotesque variável para interface/títulos; Source Serif 4 variável para leitura e citações. WOFF2 latin e latin-ext empacotados, `font-display: swap`, fallbacks Segoe UI/system-ui e Georgia. [Licenças e tamanho](UI_LICENSES.md). Raio de controles 10px, superfícies 14–18px, foco 3px e alvos de toque 44px.

Sessão: título 36–60px sobre navy, metadados reais, fita informativa com partes iguais sem ler Blobs; citação aberta marca a parte correspondente. Corpo até 680px, índice lateral condicional, abas e ações, resumo 21px e texto 18px serifado. Citações literais em painel branco; tarefas com responsável/prazo somente quando presentes. Navegação, fonte, áudio sob demanda e exportação preservados.

Popup: papel em repouso/processamento/conclusão/erro, navy gravando. Perfis em rádios nativos com setas; select oculto sincronizado conserva compatibilidade. Timer principal e canvas com 56 amostras por fonte, alimentado pelo LEVELS existente. Na simulação os níveis são identificados como ilustrativos. Sem timer em IDLE ou rodapé de produção. Progresso usa processingStage; estágio ausente não inventa etapas.

Configurações: topo navy, painel branco com seções em duas colunas, uma coluna abaixo de 760px, controles locais e barra sticky de salvar. Texto completo de privacidade preservado. Aviso de fixture somente no mock; falhas reais de acesso continuam visíveis.

Movimento permitido: pulso de gravação, spinner de fase e atualização informativa da waveform. Pulso/spinner desligam sob reduced motion; canvas não tem transições. CSP, dependências, manifest e fluxo de dados permanecem iguais.

## Resultados — Bloco 6B.2 (17/10/2026)

Revisão visual de 18/10/2026: documento sem moldura de card, eixo comum de título/abas/texto, coluna de leitura de até 40rem, ações junto às abas no desktop e índice contextual com seção atual. [Capturas, iterações e validação](RESULTS_REDESIGN_2026-10-18.md). A paleta, a fonte local e a marca abaixo permanecem.

Página real com cabeçalho utilitário, abas Notas/Transcrição/Áudio, leitura até 72ch, documento contínuo e índice marginal condicional. Evidências em “Ver fonte”, retorno de foco e referência à parte sem timestamp inventado. Ações e feedback no contexto, áudio sob demanda e diagnóstico recolhido. A implementação usa os tokens e componentes oficiais abaixo; CSS específico fica na sessão e declara a ordem compartilhada das camadas. [Relatório, capturas e limites de validação](BLOCK_6B2_RESULTS.md). Popup/configurações não receberam redesign nesta etapa.

## Base oficial — Bloco 6B.1 (17/10/2026)

Decisão explícita do usuário: **Tailwind CSS + shadcn/ui + Lucide React**, com identidade própria clara. Esta seção substitui as recomendações históricas abaixo de CSS próprio como base e tema charcoal no popup. O símbolo próprio permanece; paleta, tipografia e componentes passam a ser compartilhados. O layout completo das páginas não foi migrado.

Tokens semânticos em `src/styles/tokens.css`, mapeamento Tailwind/shadcn em `foundation.css`, componentes locais em `src/components/ui`, configuração em `components.json`. Cores: off-white #F7F8FA, branco #FFFFFF, texto #182230, secundário #596579 e azul #2453D4, com cores funcionais de sucesso/atenção/erro. Fonte Segoe UI/system-ui local; controle de 44px, radius de 8px, superfície de 12px, foco de 3px e reduced motion.

Preflight não é importado. Ordem: `theme → legacy → base → components → utilities`. CSS anterior permanece em `legacy.css`; popup CSS também fica em `legacy`. Novos componentes usam utilitários Tailwind e variantes shadcn; CSS próprio fica restrito a tokens, compatibilidade, identidade compartilhada e adaptações de plataforma/CSP. Remover regras antigas apenas quando a superfície correspondente for migrada e verificada.

Componentes iniciais: Button, Input, Badge, Native Select, Tabs e AlertDialog. O seletor de perfil mantém semântica nativa. Radix conserva foco/teclado dos componentes compostos; o overlay de AlertDialog usa CSS empacotado para evitar injeção de style por RemoveScroll. Lucide é importado seletivamente e gera SVG local. Não há CDN nem fontes remotas.

Detalhes, proveniência, validações e limites em [BLOCK_6B1_FOUNDATION.md](BLOCK_6B1_FOUNDATION.md); planejamento atualizado em [BLOCK_6A_PLAN.md](BLOCK_6A_PLAN.md). As descrições de telas completas abaixo são históricas ou metas para os próximos sub-blocos, não uma declaração de migração concluída.

Direção proposta · 01/10/2026 · atualizada para Bloco 5 em 17/10/2026, sem polimento final do Bloco 6. Descrições de mock abaixo são históricas. Comportamento segue [PRODUCT_SPEC.md](PRODUCT_SPEC.md); estados técnicos seguem [ARCHITECTURE.md](ARCHITECTURE.md).

## UI mínima implementada no Bloco 5

Popup mantém tema charcoal e perfil/timer/fontes. Gravando → Finalizar gravação; processamento → **Preparando suas notas / Ver detalhes**; concluído → **Notas prontas / Abrir resultado**. Detalhes de partes/jobs e seletor de modelo ficam fora do popup. Falha mostra acesso à fonte, retry quando aplicável e arquivamento explícito sem apagar dados.

Configurações tem select nativo **Modelo para gerar notas**, três opções, ajuda sobre próximas sessões e ausência de fallback, link discreto ao AI Studio. Não promete cota diária fixa.

Sessão prioriza resultado persistido: título sustentado/fallback perfil, modelo efetivo, data de geração, resumo, categorias com conteúdo e tarefas. Sugestões/hipóteses têm rótulo; owner/deadline ausentes não produzem placeholder. Evidências literais aparecem em details, com âncora para a parte original. Categorias vazias não são renderizadas e resultado vazio tem mensagem própria.

**Copiar notas** e **Exportar Markdown** usam o mesmo conteúdo/ordem, incluindo perfil/modelo/data e apenas categorias presentes. **Ver transcrição original** é details secundário, com cópia própria e partes intactas. Fonte e interpretação têm rótulos distintos. Falha de notas mantém fonte disponível. Seletor mínimo de sessões salvas permite consultar dados antigos; não constitui dashboard. Sessão interrompida recebe aviso e não gera análise parcial automática.

Feedback de clipboard/download é anunciado por role=status; falhas permitem repetir. Todo conteúdo externo é texto React, sem HTML executável. Estilos/tokens existentes foram preservados. Testes de markup não aprovam contraste, zoom, Narrator, foco real ou fidelidade no Edge; esses ensaios permanecem para o Bloco 6.

## Princípios e identidade

Produtividade com personalidade: espaço generoso, títulos fortes, formas arredondadas e uma ação principal por estado. Tom amigável, adulto e preciso. Evitar tabelas densas, dashboard enterprise, Material genérico, excesso de cinza/sombra, glassmorphism, gradientes sem propósito e emojis como ícone.

Conceito próprio: duas linhas suaves de áudio que se encontram em uma pequena folha/cartão de memória. Marca vetorial local simples, legível em 16/24/32px; não usar identidade de produto existente. Nome textual Meeting Memory provisório, independente do símbolo. Ícones lineares arredondados, traço consistente; Lucide opcional, importando apenas ícones usados. Ilustrações, se necessárias depois, locais e secundárias à tarefa.

## Tokens propostos

Valores são decisões de design iniciais, não CSS já instalado. Contraste deve ser medido nas combinações finais; cor suave não implica acessibilidade.

```css
:root {
  --color-background: #F7F6F2;
  --color-surface: #FFFFFF;
  --color-text: #17243A;
  --color-text-muted: #526079;
  --color-primary: #2453D4;
  --color-primary-hover: #1C43AD;
  --color-primary-soft: #EAF0FF;
  --color-mint: #D7F3E7;
  --color-mint-ink: #185A46;
  --color-accent: #6740BB;
  --color-accent-soft: #EEE7FA;
  --color-coral: #BD3948;
  --color-coral-soft: #FCEBED;
  --color-border: #DCE2E9;
  --color-control-border: #718096;
  --color-focus: #2453D4;
  --font-body: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-display: var(--font-body);
  --font-mono: ui-monospace, Consolas, monospace;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --radius-control: 12px;
  --radius-card: 20px;
  --radius-large: 28px;
  --radius-pill: 999px;
  --shadow-card: 0 6px 24px rgb(23 36 58 / 6%);
  --shadow-popup: 0 8px 28px rgb(23 36 58 / 10%);
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --ease-standard: cubic-bezier(.2, .8, .2, 1);
}
```

Off-white acolhe; azul orienta ação; mint confirma; roxo distingue contexto; coral sinaliza gravação/erro com ícone e texto diferentes. Status “Gravando” e “Falha” compartilham família coral, nunca significado dependente só da cor. Branco sobre primary/coral/accent e ink sobre soft são pares candidatos sujeitos à medição. Border suave pode ser decorativa; controles que dependem da borda usam control-border com contraste adequado.

Tipografia inicial nativa para evitar downloads e dependências. Títulos com peso 700/750, tracking discreto −0.02em; corpo 400/500, sem excesso de pesos. Fonte customizada futura só licenciada e empacotada, com fallback e teste de tamanho.

| Papel | Tamanho / linha | Uso |
| --- | --- | --- |
| Display | 36 / 42px | Título de resultado em página ampla |
| Marca do popup | 16 / 19px, peso 700 | Nome em uma linha, símbolo de pulso 28px |
| Estado do popup | 20 / 26px, peso 700 | Estado atual, sem headline editorial |
| H2 | 20 / 28px | Categorias e configurações |
| Corpo | 16 / 24px | Notas, ajuda e transcrição |
| Compacto | 14 / 20px | Metadados e labels |
| Timer do popup | 11 / 15px, números tabulares | Rodapé em mm:ss; hh:mm:ss após uma hora, sem anúncio a cada segundo |

Não esconder informação importante em fonte minúscula. Texto longo usa largura de leitura próxima de 65–75 caracteres; páginas com max-width proposto 1040px e padding 24–48px. Popup com largura 420px, definida na raiz da extensão, padding 16px e altura pelo conteúdo, sem min-height. Corpo 14px; labels/ajuda 13px; aviso de fundação 12px. Grupos separados por 16–20px, label/control por 6px. IDLE deve caber sem scrollbar e o layout funcionar a 320px sem corte de botões. Não ocultar overflow para disfarçar conteúdo cortado. Zoom 200% e reflow devem ser testados, sem truncar mensagem de erro.

## Componentes

- Botão principal: altura mínima proposta 44px, padding 12/16px, radius-control, label curto com ícone opcional. Estados default/hover/focus/pressed/loading/disabled; loading preserva largura e explica atividade.
- Botão secundário: superfície neutra/borda acessível. Ícone isolado exige nome acessível e área de toque equivalente.
- Seletor de perfil: select nativo com rótulo “Perfil”; Reunião geral, Pesquisa, Desenvolvimento e Aula. Sem cards ou descrição adicional no popup atual.
- Card: superfície branca, padding 20–24px, sombra discreta opcional; nenhuma simetria força conteúdo vazio.
- Campo: label persistente, ajuda e erro associados; placeholder não substitui label. Chave mascarada, toggle “Mostrar chave” e “Salvar”.
- Status: ícone + texto, opcional indicador; nunca apenas ponto colorido. Progresso por etapas concluídas/pendentes/erro; percentual somente quando mensurável.
- Tarefa: texto, responsável/prazo apenas se presentes e acesso à evidência. Não checkbox de conclusão persistente na V1, pois gerenciamento de tarefas não foi solicitado.
- Seção de notas: título local por kind, lista legível e referência à fonte. Fórmulas exibidas como texto legível inicialmente; sem scripts matemáticos remotos.
- Transcrição: superfície off-white, label “Transcrição original”, blocos por parte e falante local. Notas usam label “Notas geradas”. Fonte nunca recebe edição corretiva disfarçada.
- Feedback: confirmação discreta e anunciada após copiar; erro de clipboard/export com opção de repetir e instrução útil.

## Telas e estados

### Popup — pronto para começar

O popup segue as duas imagens fornecidas pelo usuário: charcoal quase neutro, texto claro, símbolo de pulso azul, badge “Pronto” verde ou “Gravando” coral no cabeçalho e engrenagem. Tokens são sobrescritos somente no popup; configurações e sessão mantêm o tema original. Superfície com border-radius de 14px, borda sutil, padding de 16px e margem externa de 6px. A janela instalada mantém 420px definidos na raiz antes do render; a prévia web adapta o conteúdo ao espaço disponível. O contorno nativo externo é controlado pelo Edge. Sem altura fixa, sombras grandes ou gradientes.

Controle rápido, sem hero ou conteúdo promocional. Cabeçalho horizontal com símbolo, nome, estado e engrenagem com title/aria-label “Configurações”. Ordem: Perfil/select → Fontes de áudio, com linhas “Áudio da aba / Aba atual” e “Microfone / Padrão do sistema” → botão azul “Iniciar gravação” em largura total → rodapé “Bloco 1 · aguardando início” e timer. Fontes são previstas, sem consulta à aba ou dispositivos. Indicadores cinza representam ausência de medição. Sem link de sessão no rodapé do IDLE; a página continua acessível nas configurações.

No Bloco 1, o build normal mantém a ação desabilitada e explica “Áudio ainda não é capturado.” Em desenvolvimento, rodapé compacto também informa “Modo de desenvolvimento · simulação”. Controles mock ficam em details recolhido, acessível por teclado. Nenhum envio, pedido de permissão ou captura foi implementado.

STARTING no mock: “Preparando simulação”, controle desabilitado e avanço manual na área de simulação. O perfil fica fixado após início.

### Popup — gravando

No Bloco 1: badge “Gravando” com nome acessível “Gravando · simulação”, perfil fixado, painel de fontes e botão “Parar gravação” contornado em coral. Barras verdes são estáticas e explicitamente ilustrativas da simulação, sem análise de nível de áudio. Timer discreto no rodapé representa somente o estado mock persistido. Avisos de simulação e ausência de captura permanecem visíveis. Sem contadores fictícios, nome real de aba ou leitura de dispositivos.

Rede indisponível não troca a captura viva por tela de erro: “Gravando · transcrição aguardando conexão”. Falha definitiva da captura muda para interrompida, sem continuar animando timer.

STOPPING no mock: “Finalizando simulação”, clique repetido bloqueado e avanço manual. PROCESSING: “Processando reunião” e “Ver detalhes”, sem contagem porque o snapshot atual não contém partes. COMPLETED: “Notas prontas” e “Abrir resultado”; o destino continua sendo a página de sessão existente, sem criar notas. ERROR: mensagem curta da fase simulada e “Tentar novamente” somente se processamento recuperável com material; caso contrário, “Reiniciar simulação”. Aviso mock permanece em todos os estados.

### Configurações

Página calma com blocos: chave Gemini, idioma pt-BR padrão, retenção e privacidade. Input mascarado, Salvar e Testar chave; teste mostra acesso verificado e modelos ainda não verificados quando aplicável. Sem enviar chave ao abrir a tela.

Retenção por sessão: padrão “Apagar áudio após transcrever”; ajuda “O texto será preservado. Depois de apagar o áudio, não será possível ouvi-lo ou transcrevê-lo novamente.” Alternativa “Manter gravação local”. Falhas preservam áudio recuperável independentemente do padrão. Aviso de envio cloud e limite de proteção da chave no perfil local. Configurações avançadas de teste ficam fora do fluxo normal.

### Página da sessão — processamento e recuperação

Cabeçalho “Gravação concluída” ou “Gravação interrompida”, com data/duração/perfil. Linha por parte: “Parte 1 transcrita”, “Parte 2 transcrevendo”, “Parte 3 aguardando conexão”. Etapa final “Organizando suas notas”, somente quando realmente começou. Nada de percentuais fictícios.

Falha mostra qual parte precisa de ação e se áudio está preservado. Botões “Tentar novamente”, “Revisar chave” e acesso à transcrição disponível conforme contexto. Lista compacta de sessões pendentes permite reencontrar a recuperação após reinício. Se executor exigir página aberta, aviso explícito antes de iniciar; escolha final depende de DEC-007.

### Página da sessão — resultado

Cabeçalho com título sustentado ou fallback data/perfil, metadados e status. Em interrupted, faixa persistente: “Esta gravação foi interrompida. As notas cobrem apenas o áudio recuperado.” Ações: Copiar notas, Copiar transcrição, Exportar Markdown; wrap responsivo.

Resumo primeiro quando presente, seguido de seções relevantes e tarefas. Sem cards vazios e sem texto gerado só para preencher. Quando nenhuma nota for sustentada, mensagem local “Não encontramos conteúdo suficiente para organizar notas” e fonte acessível; isso é estado vazio válido, distinto de erro de análise.

Transcrição em seção visualmente distinta, expansível por parte sem esconder sua disponibilidade. Labels “Parte 1 · Falante 1” conservam contexto; overlap e lacunas sinalizados. Evidência abre bloco de origem por teclado com foco previsível. Export Markdown mantém ordem, metadados, aviso de incompletude e áreas separadas para notas e transcrição.

## Motion e acessibilidade

Microinterações apenas em opacity/transform discretos, 120–180ms; sem animação contínua decorativa. Indicador de gravação pode pulsar suavemente somente sem reduced motion, mantendo ícone/texto estáticos quando reduzido.

WCAG AA como alvo: contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande e elementos gráficos de controles/foco quando aplicável. Focus outline 2–3px com offset, nunca removido. Label visível, heading hierárquico, aria-describedby para ajuda/erro, aria-live polite para mudanças de fase; não anunciar cada segundo do timer. Erros que exigem atenção podem usar alert sem spam.

Tab order segue leitura; Escape fecha controles/modal e devolve foco; interação por teclado deve alcançar iniciar/finalizar/exportar/evidência. Disabled tem explicação próxima quando motivo não é evidente. Dialog de ação destrutiva futura só quando necessária à exclusão real, sem confirmations para ações rotineiras. Testar Narrator no Edge e prefers-reduced-motion.

## Validação visual pendente

Tokens/layouts permanecem [NÃO VALIDADO] na UI real do Edge. Bloco 1 aplica CSS variables, marca SVG local, fonte do sistema, labels, foco, disabled e reduced motion; não há CDN ou biblioteca de ícones. O popup normal informa que áudio ainda não é capturado; outras páginas mantêm o aviso de fundação. Estados e exemplos somente no build de simulação, com aviso explícito. Conteúdo vazio, distinção fonte/notas e hierarquia dos estados do popup possuem testes de renderização, que não comprovam acessibilidade ou aparência no navegador. Na revisão do popup não havia navegador conectado: largura de 420px e regras de reflow foram revisadas no CSS; altura real, ausência de scrollbar, quebras de texto e foco permanecem pendentes de inspeção no Edge. Bloco 6 medirá contraste, zoom, teclado, leitores de tela, popup real, texto longo, erro, estados vazios e todos os perfis. A revisão mais recente usa as duas referências visuais enviadas pelo usuário para IDLE e RECORDING; a fidelidade final permanece pendente de inspeção no Edge.
