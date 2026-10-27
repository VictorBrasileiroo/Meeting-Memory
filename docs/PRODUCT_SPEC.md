# Meeting Memory — especificação histórica do produto

> Documento histórico por blocos. Para funcionalidades entregues, limites e prontidão atuais, consulte [estado atual](STATUS.md), [README](../README.md) e [auditoria 7B](BLOCK_7B_AUDIT.md). As pendências antigas abaixo não descrevem sozinhas a versão atual.

Atualização de UX em 17/10/2026: o usuário autorizou somente o **6B.1 — Fundação visual**, com Tailwind CSS, shadcn/ui e Lucide React. Tokens, marca e controles compartilhados evoluem sem alterar os Blocos 1–5. Reformulação completa, biblioteca, cancelamento, concorrência e importação continuam planejados. O relato atual do usuário confirma o fluxo principal real e prevalece sobre pendências históricas de “primeira análise” abaixo. [Entrega e validações](BLOCK_6B1_FOUNDATION.md).


Versão documental 0.5 · 17/10/2026 · uso pessoal. Blocos 1–5 implementam fundação, captura, fila, transcrição e notas automáticas. Bloco 5 está pronto para validação manual; análise real no Edge ainda não foi executada nesta etapa. Polimento do Bloco 6 e auditoria de release do Bloco 7 não foram iniciados.

## Comportamento implementado no Bloco 5

O fluxo de produção é selecionar perfil → iniciar → participar → finalizar → aguardar notas. Cada parte pode transcrever durante a captura. A análise textual consolidada começa somente após encerramento íntegro e persistência de todas as partes esperadas. `COMPLETED` significa notas validadas e persistidas, inclusive um resultado legitimamente vazio. Sessão interrompida ou com parte ausente não recebe análise parcial automática.

Configurações oferece **Modelo para gerar notas**: Econômico — Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`, padrão), Equilibrado — Gemini 3.6 Flash (`gemini-3.6-flash`), Avançado — Gemini 3.8 Flash (`gemini-3.8-flash`). A preferência é local, validada por allowlist e fixada no início de cada nova sessão. Transcrição mantém `gemini-3.5-transcribe`. Alterar preferências não muda análises em andamento; falhas nunca provocam troca automática. Acesso/cotas dependem do projeto; link ao AI Studio está nas Configurações.

Diarização é **opcional** por decisão explícita do usuário. Metadata existente continua preservada e local por parte; sem labels, a análise usa rawText normalmente. Não há segunda diarização, retranscrição para obter labels nem nomes inventados. A investigação anterior permanece em DEC-024.

Notas têm categorias por perfil, resumo, tarefas com owner/deadline nulos quando desconhecidos, distinção de sugestão/hipótese e citações literais verificadas. Categorias vazias ficam ocultas. As notas são interpretação; estrutura e evidência validada não garantem correção semântica do modelo.

O popup mostra “Preparando suas notas” e “Notas prontas”, sem controles de análise ou detalhes de fila. A página mostra notas primeiro, modelo utilizado, evidências, fonte original recolhível, copiar notas/transcrição e exportar Markdown. Sessões salvas permitem consultar resultados anteriores. Arquivar uma falha terminal libera nova gravação sem apagar fonte; retry explícito de notas também funciona em sessões salvas. Sessões antigas sem modelo fixado permanecem consultáveis e não disparam análise nova automaticamente.

Overlap permanece integral na fonte. O interpretador recebe partes ordenadas, limites e aviso de sobreposição; duplicatas textualmente idênticas nas notas são eliminadas apenas na projeção validada. Antes da API há orçamento conservador de contexto; se excedido, erro exige ação, permite copiar a fonte e nunca apresenta notas truncadas. Análise hierárquica não está implementada.

Este documento define o comportamento esperado. [ARCHITECTURE.md](ARCHITECTURE.md) define os contratos técnicos; [DECISIONS.md](DECISIONS.md) registra decisões e pendências; [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) define a apresentação; [TEST_PLAN.md](TEST_PLAN.md) define como obter evidência. Alterações de escopo devem atualizar os documentos afetados.

## Problema, usuário e objetivo

Um único usuário quer acompanhar reuniões, aulas e chamadas em uma aba do Microsoft Edge sem precisar escrever todas as notas durante a conversa. Meeting Memory captura o áudio da aba e seu microfone, preserva uma transcrição e organiza notas conforme o contexto. O nome é provisório.

A extensão não entra na reunião como participante. Captura localmente e envia áudio à Gemini API para transcrição; envia texto para análise. Uso pessoal e armazenamento local não significam processamento inteiramente offline.

Princípio: a transcrição retornada é a fonte preservada; notas são interpretação. Transcrição automática também pode conter erros e não deve ser apresentada como prova infalível do que foi dito.

## Escopo da V1

- Edge desktop moderno, extensão Chromium Manifest V3, instalada via Load unpacked.
- Uma gravação ativa por vez, somente áudio, aba selecionada e microfone simultâneos.
- Áudio da reunião audível; microfone sem monitoramento na saída.
- Popup pode fechar sem parar a captura.
- Segmentos próximos de 29m30s, com duração menor configurável para desenvolvimento.
- Persistência temporária em IndexedDB, transcrição progressiva e fila recuperável.
- Gemini, modo verbatim, pt-BR padrão, diarização por contexto de chunk; sem timestamps por palavra.
- Quatro perfis, análise estruturada validada, resultado, configurações, cópia e Markdown.
- Indicador explícito, mensagens de erro úteis, acessibilidade e retenção configurável.

Não escopo: login, contas, backend próprio, banco remoto, Docker, Python, FFmpeg, loja, sincronização, colaboração, desktop app, vídeo, clientes nativos de Zoom/Teams/Discord, biometria vocal ou identificação global automática de falantes. Não há recursos visuais remotos obrigatórios. Não há retomada automática de captura após reinício do navegador.

“Duração arbitrária” significa ausência de um limite total fixo imposto pelo produto enquanto navegador, dispositivo e armazenamento permitem. Não promete gravação infinita, continuidade durante suspensão, nem análise em uma única chamada de qualquer volume de texto. Limites e caminho para transcrições grandes estão em DEC-013.

## Fluxos

### Preparação e gravação

1. Nas configurações, inserir chave própria, testar acesso, ler aviso cloud e escolher retenção. O teste da chave não prova acesso a todos os modelos.
2. Abrir a reunião na aba desejada, invocar a extensão, escolher Geral, Pesquisa, Desenvolvimento ou Aula.
3. Iniciar por ação explícita. Se necessário, abrir uma página visível da extensão para conceder microfone; depois voltar à aba da reunião e invocar novamente a extensão.
4. Só mostrar “Gravando” quando ambas as fontes e recorder estiverem ativos. Exibir timer, perfil fixado para a sessão e partes já transcritas.
5. Fechar/reabrir popup conserva estado. Processamento de uma parte não pausa a próxima captura.
6. Finalizar uma vez, salvar última parte, encerrar recursos e apresentar progresso.

### Resultado e recuperação

1. A análise final começa somente após todos os chunks válidos esperados terem transcrição persistida.
2. Exibir título, data, duração, perfil, resumo e categorias com conteúdo; transcrição em área própria.
3. Copiar notas, copiar transcrição ou exportar Markdown, preservando a distinção entre fonte e interpretação.
4. Falhas temporárias fazem tentativas limitadas; falhas permanentes pedem ação adequada. O usuário pode corrigir a chave e tentar novamente sem repetir a gravação quando o áudio necessário ainda existir.
5. Sessão interrompida pode processar as partes recuperáveis, mas recebe indicação permanente de incompletude. Nunca apresentar resultado parcial como reunião integral.
6. Após reinício, encontrar sessões e trabalhos pendentes por identificador; oferecer recuperação mesmo sem popup anterior. A navegação mínima para sessões pendentes faz parte da recuperação, sem exigir um dashboard de histórico.

## Perfis

Pipeline e contrato compartilhados. Perfil determina categorias permitidas e instruções, não uma implementação diferente.

| Perfil | Categorias possíveis, além de resumo |
| --- | --- |
| Geral | principais assuntos, decisões, direcionamentos, tarefas, responsáveis, pendências, pontos importantes |
| Pesquisa | principais assuntos, orientação, decisões metodológicas, hipóteses, experimentos sugeridos/definidos, referências/papers mencionados, tarefas, pendências, dúvidas em aberto, pontos importantes |
| Desenvolvimento | principais assuntos, requisitos, decisões arquiteturais, mudanças solicitadas, bugs/problemas, riscos, tarefas, responsáveis, pendências |
| Aula | tópicos, conceitos, definições, exemplos, fórmulas, pontos enfatizados, dúvidas, possíveis tópicos de avaliação/prova |

Todas são opcionais em conteúdo. Experimentos sugeridos devem permanecer sugestões. Referências não ganham autores, DOI ou links inventados. Avaliações só aparecem se mencionadas; não adivinhar o que cairá na prova. Responsáveis são projeção das tarefas ou informação explícita, sem duplicar atribuições inferidas.

## Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | Capturar exclusivamente a aba autorizada e microfone; sem vídeo ou outras abas. |
| RF-02 | Reproduzir somente a fonte da aba na saída; indicador visível durante toda captura. |
| RF-03 | Manter gravação independente do popup e impedir comandos/transições inválidos. |
| RF-04 | Gerar arquivos independentes por chunk e preservar metadados de fronteira. |
| RF-05 | Persistir áudio antes de enfileirar; nenhuma rede no caminho crítico da captura. |
| RF-06 | Transcrever progressivamente, preservando resposta original e labels locais de falantes. |
| RF-07 | Reconciliar filas interrompidas, oferecer retry e distinguir falha de limpeza remota. |
| RF-08 | Consolidar em ordem, sem reescrita da fonte nem união automática de identidades. |
| RF-09 | Analisar com schema, validação estrutural e referências à fonte. Ausência é válida. |
| RF-10 | Não renderizar categorias vazias; owner/deadline desconhecidos são null. |
| RF-11 | Configurar chave, idioma e retenção; não expor chave em logs, exports ou UI de erro. |
| RF-12 | Copiar notas/transcrição e exportar Markdown sem perder informação de incompletude. |
| RF-13 | Aplicar retenção segura e mostrar interrupções/lacunas conhecidas. |

## Requisitos não funcionais

- RNF-01: frontend e assets empacotados; TypeScript, React, Vite e adapters testáveis; dependências mínimas.
- RNF-02: memória limitada por buffers curtos, persistência progressiva e leitura de um chunk por trabalho; não manter toda reunião em RAM.
- RNF-03: gravação continua durante offline/429 enquanto houver espaço. Falha de disco pode exigir parada explícita segura.
- RNF-04: teclado, foco visível, labels, contraste, reduced motion e status além de cor.
- RNF-05: logs sanitizados sem chave, áudio ou texto sensível por padrão; cloud e retenção comunicados claramente.
- RNF-06: testes, consulta documental e captura real são evidências distintas.
- RNF-07: operações duráveis toleram repetição; exportação e análise não alteram resposta original.

## Critérios de aceite da V1

RF-01–13 devem possuir evidência no plano de testes. Uma reunião real no Edge deve demonstrar as duas fontes, reprodução correta, popup fechado, processamento simultâneo e pelo menos duas fronteiras de chunk. A duração real de produção também deve ser exercitada; testes acelerados não bastam.

Offline, chave inválida, 429, reinício do worker, fechamento da aba, perda do offscreen e quota devem produzir estados explicáveis sem apagar material recuperável. Uma sessão interrompida deve manter seu aviso em UI e export.

Os quatro perfis devem passar por fixtures com categorias ausentes, hipóteses, silêncio e tarefas sem dono/prazo. Nenhuma categoria vazia deve aparecer. Fonte preservada, schema inválido rejeitado, falante local respeitado e Markdown conferido.

Não declarar V1 validada enquanto os gates abertos de DEC-004/007 e os ensaios reais de notas não tiverem resultado. O build normal captura, transcreve e gera notas automaticamente com chave configurada. O build de chunks curtos mantém clique por tentativa de transcrição; após finalizar e completar todas as transcrições, gera **uma análise textual automática**, sujeita a cobrança. Simulação permanece exclusiva de desenvolvimento/testes. O caminho para volumes acima do contexto é falha explícita com fonte preservada (DEC-027).
