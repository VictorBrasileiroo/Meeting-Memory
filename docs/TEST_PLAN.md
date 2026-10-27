# Meeting Memory — plano de testes e evidências

> Roteiros/evidências históricos, não declaração de execução de todos os cenários. Os comandos atuais estão em [TESTING.md](TESTING.md), com resultados da preparação em [7C](BLOCK_7C_PUBLICATION.md). Harnesses em `.verification/` não são distribuídos; testes publicados ficam em `tests/` e `scripts/`. Os roteiros e as decisões abaixo foram preservados.

## Reuniões e armazenamento — 20/10/2026

**279 testes em 32 arquivos**, lint, typecheck, builds normal/fixtures e auditorias aprovados. Cobertura nova: migração aditiva v4→v5, tamanho atual de Blobs/fragmentos/texto, áudio sem perda de notas, cascata isolada, rollback transacional, elegibilidade alterada, concorrência, tombstones, respostas atrasadas e limpeza remota durável. Dois testes existentes atualizam somente a versão esperada do banco de 4 para 5; as demais asserções anteriores permanecem.

Edge isolado: 10 verificações integradas com IndexedDB nativo e código real de persistência/background, 30 combinações responsivas da biblioteca e 75 de regressão dos resultados, teclado/foco, falha parcial/repetição, duas páginas, reabertura, URLs revogadas e quota indisponível. Transporte Chrome/offscreen é simulado; nenhuma chave, reunião real ou API autenticada foi usada. As suites de fixtures/resultados registram o probe de eval bloqueado do Zod já existente, com bundle preservado; a suite nativa terminou sem eventos de CSP. Não houve exceções nem tráfego remoto nos relatórios finais. [Reprodução, capturas, hashes e limitações](MEETING_MANAGEMENT.md).

## Bloco 6B.2 — Resultados e leitura (17/10/2026)

Typecheck, lint, **243 testes em 27 arquivos**, build normal, build de fixtures e auditorias aprovados. Trinta arquivos críticos e notes-export.ts preservados por hash; nenhum teste anterior modificado. Edge 155.0.4283.62 headless, arquivos empacotados sob CSP original por HTTP: 75 combinações de cenário/largura (incluindo 320/375px), teclado/foco, evidências, histórico/ID, cópia/exportação, áudio sintético, liberação de URLs, reduced motion e forced colors passaram. Zero exceções, violações de CSP ou requisições remotas. O banco e o transporte runtime são de teste; nenhuma instalação/chave/reunião real foi acessada. Pendentes: aprovação visual, Narrator, zoom pelo menu e smoke test com WebMs/reuniões reais na mesma instalação. [Relatório completo](BLOCK_6B2_RESULTS.md); artefatos em `.verification/block-6b2/`.

## Bloco 6B.1 — Fundação visual (17/10/2026)

Base oficial Tailwind CSS + shadcn/ui + Lucide React. Typecheck, lint e **228 testes em 26 arquivos** aprovados; build normal/auditoria e build de fixtures executados. Trinta arquivos de núcleo/manifest preservados por SHA-256; lógica anterior ao render e event handlers do popup/configurações iguais por AST.

Inspeção em Edge 155 headless com arquivos empacotados e CSP original aplicada por HTTP: modal/foco/Tab/Shift+Tab/Escape, tabs, controles e 20 combinações de largura/superfície. Evidência final em `.verification/block-6b1/browser-checks.json`; preservação em `preservation.json`. Detalhes em [BLOCK_6B1_FOUNDATION.md](BLOCK_6B1_FOUNDATION.md). Não equivale a captura real, Gemini autenticado ou Load unpacked. Restam validação do usuário, smoke test da mesma instalação, Narrator/zoom/forced colors.


Plano da V1, histórico desde 01/10/2026, atualizado até o Bloco 5 em 17/10/2026. Os relatos recentes substituem estados antigos pendentes. Consulta documental e testes com mocks não validam comportamento real no Edge. Blocos 6/7 não executados.

## Correção pontual do Bloco 5 — diagnóstico HTTP 400 e retomada da análise

### Schema completo rejeitado no Lite; análise em JSON com validação local — 17/10/2026

**Nova evidência real do usuário, substituindo a inconclusão anterior:** integrationProbe v2, model `gemini-3.5-flash-lite`: TEXT_ONLY, JSON_ONLY, OUTPUT_LIMIT e MINIMAL_SCHEMA foram ACCEPTED; NOTES_SCHEMA foi FAILED/HTTP 400/invalid_request, com mensagem genérica sem fieldViolations. Entre as duas últimas chamadas, a configuração alterada foi apenas response_format.schema. Isso isola a rejeição no schema completo naquele ensaio Lite. **Não identifica a keyword/limite interno**, não prova que a causa seja profundidade/maxItems/nullable, não explica definitivamente o primeiro 400 no Flash e não valida qualidade de notas reais. O tamanho/profundidade eram métricas de investigação, não limites comprovadamente excedidos.

Mudança aplicada ao adapter de análise: `response_format:{type:'text',mime_type:'application/json'}`, **sem schema nesse campo**. Essa modalidade e max_output_tokens:32768 foram aceitos no ensaio. Contrato público do perfil é incluído somente nas instruções do sistema, separado do transcript não confiável. JSON/schema/evidências/atribuições/categorias continuam sendo validados rigorosamente pelo mesmo código local antes de qualquer commit; nenhuma regra foi relaxada. Não há fallback automático entre modos. O schema original permanece disponível para diagnóstico e testes; remover regras isoladas por suposição não foi necessário. Prompt passa à versão 2; o formato das notas continua versão 1 e aceita metadados históricos promptVersion:1. O preflight inclui o contrato textual uma única vez no orçamento. [Referência: schema é opcional em TextResponseFormat](https://ai.google.dev/api/interactions-api#TextResponseFormat).

**Retomada desta sessão com Lite, conforme escolha explícita do usuário:** botão **Reprocessar notas com Lite** envia RETRY_ANALYSIS com analysisModel literal Lite. Somente job terminal com fonte completa, sem resultado e sem lease ativo pode receber a escolha. O mesmo job canônico ganha analysisModelOverride, conservado por falha/restart; não cria outro job nem modifica Recording.analysisModel original, preferências, áudio ou transcripts. Executor usa o modelo escolhido; resultado registra o modelo efetivamente usado. Fonte e modelo original seguem preservados. A UI informa o modelo de reprocessamento. Botão genérico mantém a escolha já gravada no job, se houver. A troca não é acionada automaticamente por um erro/cota.

Procedimento exato: (1) em `edge://extensions`, recarregue a **mesma instalação**, usando a pasta que já estava carregada (`dist` ou `dist-chunk-test`); não remover a extensão nem apagar dados; (2) recarregue a página da sessão e selecione a reunião que falhou em Sessões salvas; (3) clique **Reprocessar notas com Lite** uma vez, autorizando envio do texto salvo e possível cobrança; (4) aguarde e confira notas/modelo Lite; se falhar, copie o diagnóstico seguro. Não gravar/transcrever novamente e não repetir o teste de cinco chamadas para tentar gerar notas: ele continua diagnóstico, incluindo o schema antigo rejeitado. Resultado remoto ainda requer essa validação real; nenhuma chamada autenticada foi executada pelo agente.

[VALIDADO AUTOMATICAMENTE] Typecheck, lint, **223 testes / 25 arquivos**, build e build:chunk-test com auditorias aprovadas. Regressões: SDK web/node sem schema remoto e com contrato nas instruções, servidor simulado que rejeita schema e aceita JSON, validação estrita conservada, notas antigas compatíveis, comando de retry aceita apenas escolha Lite explícita, concorrência/lease/cooldown/resultado existente protegidos, mesmo ID de job, modelo efetivo no resultado, fonte preservada e override Lite persistente após 429/restart.

### Teste mínimo com Lite, autorizado explicitamente — 17/10/2026

O usuário autorizou simplificar o teste e usar Lite porque esgotou a cota diária do Flash. O botão agora é **Testar integração com texto fictício (Lite)**. Novos ensaios registram `integrationProbe.version:2` e `integrationProbe.model:gemini-3.5-flash-lite`, independentemente do modelo original da sessão. Isso não é fallback após erro; todas as etapas usam Lite desde o início. A escolha não modifica a gravação, a preferência de Settings, o transcript nem o modelo original de análise real. O botão **Reprocessar somente as notas** continua usando o modelo salvo da sessão e não deve ser usado para este ensaio Lite de uma sessão Flash.

O novo ensaio tem até cinco chamadas: **TEXT_ONLY** (`{model:'gemini-3.5-flash-lite',input:'Responda apenas OK.',store:false}`), JSON_ONLY, OUTPUT_LIMIT, MINIMAL_SCHEMA e NOTES_SCHEMA. A primeira não inclui system_instruction, response_format, schema ou generation_config. JSON_ONLY introduz a instrução e o texto fictícios fixos e o formato JSON; as três etapas seguintes continuam acrescentando uma configuração por vez. Portanto TEXT_ONLY→JSON_ONLY não isola um único campo; eventual falha nessa transição exige refinamento, sem atribuição automática de causa. Mantidos espaçamento mínimo de 61s, parada na primeira falha inclusive 429, nenhuma reunião enviada, nenhum output salvo como nota e nenhuma análise real automática. Até cerca de quatro minutos se todas passarem. Sucesso no Lite não explica retrospectivamente o HTTP 400 do Flash.

Compatibilidade: ensaios v1 persistidos conservam os índices antigos e o limite de quatro claims; se ainda ativos, são encerrados sem envio ao Flash, permitindo iniciar explicitamente o novo teste Lite. Resultados antigos já concluídos permanecem consultáveis. O ensaio v2 tem limite de cinco claims, inclusive sob crash; versão/modelo são preservados em cada commit. Mesmo job e fila, sem duplicações.

Procedimento: recarregue a mesma instalação da extensão em `edge://extensions` e a página da sessão salva; clique **Testar integração com texto fictício (Lite)** uma vez. Aguarde concluir/interromper e copie **Diagnóstico seguro da Gemini** com `integrationProbe`, conferindo model Lite e etapa TEXT_ONLY. Não gravar nem transcrever novamente. Nenhuma chamada autenticada foi executada durante a implementação.

[VALIDADO AUTOMATICAMENTE] Typecheck, lint, **217 testes / 25 arquivos**, build e build:chunk-test com auditorias aprovadas. Regressões verificam payload mínimo exato nos exports node/web reais do SDK com fetch interceptado, cinco etapas Lite em sessão originalmente Flash, modelo/versão persistidos entre etapas, preservação da fonte/modelo original, limite de cinco claims sob crash, primeira falha sem retry e encerramento de ensaio legado sem chamada externa. [REQUER TESTE REAL] Cota/acesso do Lite e resultado das etapas na chave do usuário. A causa do HTTP 400 original continua indeterminada.

### Conferência das hipóteses de sampling e complexidade do schema — 17/10/2026

O [guia oficial de migração 3.6/3.5 Lite](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.6#api-changes-and-parameter-updates) manda remover temperature/top_p/top_k; especifica que são ignorados nesses modelos e que gerações futuras podem rejeitá-los com 400. O adapter já não envia esses parâmetros. Regressões novas interceptam o HTTP do export **web** do SDK 2.24.0, usado pelo bundle da extensão: para os três modelos, generation_config contém exclusivamente max_output_tokens:32768. As quatro etapas sintéticas também não recebem defaults de sampling do SDK; JSON_ONLY continua sem generation_config. Não há prefill de turno de modelo: input é texto, instruções ficam em system_instruction. Não foi necessária alteração do request.

O [guia de structured output](https://ai.google.dev/gemini-api/docs/structured-output#limitations) confirma o subconjunto de JSON Schema e a possibilidade de rejeição por complexidade, sem estabelecer um limite numérico de profundidade/tamanho nessa página. Inspeção pública local dos schemas atuais:

| Perfil | Bytes UTF-8 do schema compacto | Profundidade máxima de objetos/arrays |
| --- | ---: | ---: |
| general | 1861 | 7 |
| research | 1910 | 7 |
| development | 1905 | 7 |
| class | 1886 | 7 |

Profundidade conta a raiz como nível 1: raiz → sections[] → seção → items[] → item → evidence[] → referência. Cada schema tem oito nós de objeto, sete de array e 23 definições de propriedades, contando repetições estruturais. Keywords presentes: type, properties, required, additionalProperties, enum, items, minItems, maxItems; todas documentadas. recordingId/profile/analysisModel/schemaVersion/promptVersion/createdAt/sourceKey pertencem ao envelope local e não integram o schema enviado. Testes percorrem todos os perfis para impedir introdução inadvertida de keywords não conferidas ou metadados locais. Métricas públicas em `.verification/schema-review/metrics.json`; não contêm dados de sessão.

**Evidência real mais recente do usuário:** integrationProbe terminou em JSON_ONLY com HTTP 429, antes de enviar schema ou limite de saída. Esse ensaio não comprova nem descarta a hipótese de complexidade e não explica o 400 anterior. A causa específica continua não identificada; não foi simplificado o schema por suposição. Quando a cota estiver disponível, o teste fictício existente pode comparar MINIMAL_SCHEMA com NOTES_SCHEMA, mantendo modelo/instrução/input constantes. Mesmo um 400 somente em NOTES_SCHEMA apontaria para a configuração do schema, sem identificar automaticamente a keyword/limite exato. Não repetir tentativas reais da reunião para obter esse diagnóstico.

[VALIDADO AUTOMATICAMENTE] Typecheck, lint, **215 testes / 25 arquivos**, build e build:chunk-test com auditorias aprovadas, incluindo export web real do SDK com HTTP interceptado. Nenhuma chamada autenticada realizada nesta conferência; captura/transcrição, modelos e request de produção não foram alterados.

### Retorno genérico confirmado e teste isolado de integração

O usuário retornou `invalid_request`, `request contains an invalid argument .`, genericMessage:true, messageRedacted:false, detailCount:0 e fieldViolations:[]. Agora a evidência é que o provedor não informa o parâmetro rejeitado nessa resposta. Não é um detalhe escondido pelo filtro. Nenhuma causa específica foi declarada resolvida. A serialização/schema foram novamente inspecionados localmente contra a referência oficial; não houve incompatibilidade comprovada que justificasse trocar parâmetros, SDK ou modelo no fluxo normal.

Foi adicionado **Testar integração com texto fictício**, exclusivamente por ação explícita na sessão com falha. Usa o modelo fixado e o mesmo job ANALYZE_RECORDING/fila/lease/heartbeat, sem criar outra fila. O executor deste modo lê somente modelo/perfil; não envia áudio, transcript, prompt da reunião, IDs de partes ou notas. `store:false`, nenhum tool/grounding, retries internos desabilitados. O texto e a instrução do sistema do teste são constantes e iguais nas quatro etapas:

1. JSON_ONLY: response_format JSON, sem schema e sem generation_config.
2. OUTPUT_LIMIT: mesma chamada, adicionando max_output_tokens:32768.
3. MINIMAL_SCHEMA: mesma chamada, adicionando schema público mínimo `{ok:boolean}`.
4. NOTES_SCHEMA: mesma chamada, substituindo apenas o schema mínimo pelo schema real de notas do perfil.

Até quatro claims/chamadas, com pelo menos 61s entre etapas; falha HTTP (inclusive 429/5xx) encerra sem retry automático. Crash/lease perdido consome orçamento conservador e pode impedir completar todas as etapas; não autoriza quinta chamada. Avanço fica no próprio job e sobrevive a restart. Não promete exactly-once se a resposta se perder antes do commit. Cada resultado guarda somente stage e ACCEPTED/FAILED, além do diagnóstico sanitizado em falha; nenhum output sintético é salvo como notas. Ao concluir/interromper, job permanece ERROR/PERMANENT para impedir iniciar a análise real automaticamente. Retry de notas posterior exige outra ação explícita e preserva resultados técnicos. ACCEPTED significa requisição aceita pelo SDK/API, não validação de qualidade ou sucesso de notas reais.

**Próximo teste manual:** recarregue a mesma extensão e a página da sessão; clique **Testar integração com texto fictício** uma vez, mantendo a chave/projeto e modelo. Pode gerar cobrança de até quatro chamadas e leva cerca de três minutos se todas forem aceitas. Ao parar/concluir, copie **Diagnóstico seguro da Gemini** com o campo `integrationProbe`. Não clique novamente em Reprocessar somente as notas para este diagnóstico. Se houver 429/5xx, o ensaio é inconclusivo para schema/parâmetros; não atribuir a causa ao campo da etapa. Se todas passarem, isso não prova que o request completo da reunião funciona. Nenhuma das chamadas foi executada automaticamente nesta implementação.

[VALIDADO AUTOMATICAMENTE nesta revisão] Typecheck, lint, **203 testes / 24 arquivos**, build e build:chunk-test. Regressões de serialização exata por etapa com SDK real/HTTP interceptado, modelo fixado, ausência de dados da reunião, mesmo job/fila, espaçamento, primeira falha/429/5xx sem retries, máximo quatro claims sob crash, lease antigo recusado, avanço persistido, concorrência/replay, ausência de notas sintéticas e retry real posterior explícito. [REQUER TESTE REAL] Resultado de integrationProbe. Captura/transcrição permanecem intocadas, Blocos 6/7 não iniciados.

Arquivos desta revisão: `src/domain/analysis-probe.ts`, `src/gemini/analysis.ts`, `src/storage/recordings.ts`, `src/queue/job-policy.ts`, `src/queue/local-worker.ts`, protocolo/fronteira mock/handler de reprocessamento, `AnalysisFailure.tsx`, `SessionApp.tsx` e testes correspondentes. Artefato local de inspeção em `.verification/schema-review/` contém somente código/schema públicos, sem transcrições ou credenciais.

Retorno real posterior: usuário forneceu diagnóstico com HTTP 400, code invalid_request e `request [omitido] an invalid [omitido] .`. Isso confirma rejeição da requisição, sem identificar campo/causa. O filtro omitia também as palavras técnicas `contains`/`argument`; foi ampliado para elas, sem tentar reconstruir retrospectivamente a mensagem real. A frase genérica conhecida é agora marcada por genericMessage, sem inventar causa. Quando a resposta trouxer detalhes Google RPC com fieldViolations, seus campos/descrições também são projetados pelo mesmo filtro, sem expor metadata ou corpo bruto. A presença desses detalhes não é presumida para Interactions. A UI explica que repetir mensagem genérica não esclarece a causa por si só. Testes adicionais cobrem a frase e detalhes com valores sensíveis. Nenhuma nova chamada real foi feita; causa continua não comprovada.

Relato real do usuário: captura concluída, transcrição automática 1/1 preservada, interpretador `gemini-3.6-flash`, HTTP 429 transitório seguido de HTTP 400 permanente, sem notas. Isso comprova a falha real de análise, **não sua causa exata**. O código anterior descartava code/message do provedor e bloqueava retry de análise PERMANENT. Esses dois defeitos foram corrigidos; o HTTP 400 original não tem detalhe recuperável no registro antigo.

Inspeção do SDK instalado `@google/genai` 2.24.0 (implementações web/node) mostra APIError/BadRequestError com `status`, `error`, `body`, `message` e headers. Teste com SDK real e fetch interceptado comprova extração de `error.code`/`error.message`, incluindo envelope `{error:{...}}` e código numérico Google. `body`, headers, erro SDK e mensagem bruta **não são logados nem persistidos**. `lastAnalysisDiagnostic` no mesmo job registra status HTTP, versão do SDK/endpoint, código por allowlist, presença dos campos e projeção da mensagem em vocabulário técnico fixo. Palavras, números, nomes, URLs ou valores desconhecidos viram `[omitido]`. A UI permite consultar/copiar somente essa projeção; ela pode ser insuficiente para concluir a causa.

Conferência documental atual: [Interactions](https://ai.google.dev/api/interactions-api), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini 3.6 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash), [erros](https://ai.google.dev/gemini-api/docs/api-errors), [store:false](https://ai.google.dev/gemini-api/docs/interactions-overview). O modelo é listado como suportado e com structured output; `response_format:{type:'text',mime_type:'application/json',schema:...}`, `generation_config.max_output_tokens:32768` e store:false correspondem ao contrato documentado. O schema atual usa o subconjunto documentado. **Não há evidência de qual campo foi rejeitado no ensaio**; request, schema, SDK e modelo foram mantidos, sem correção especulativa ou fallback.

HTTP 400 continua sem retry automático, mas a mensagem agora explica rejeição da requisição e acesso ao diagnóstico, sem atribuir automaticamente à chave. **Reprocessar somente as notas** reabre o job canônico de análise terminal, inclusive PERMANENT ou budget esgotado. A transação verifica fonte completa, modelo fixado, ausência de resultado e ausência de lease ativo; não cria job, muda modelo ou toca transcrições/jobs de áudio. Repetição concorrente/replay é idempotente; cooldown transitório continua respeitado. Comando confiável RETRY_ANALYSIS permite também sessão salva fora do snapshot. O executor existente fica aberto enquanto houver trabalho pendente de qualquer sessão e fecha ao concluir; nenhuma arquitetura de captura foi alterada.

[VALIDADO AUTOMATICAMENTE] Typecheck, lint, **192 testes / 23 arquivos**, build normal e build:chunk-test. Regressões: SDK HTTP 400 com código/mensagem reais de fixture sintética, privacidade adversarial, mensagem sem detalhe, schema/parâmetros serializados para 3.6, diagnóstico persistido, retry permanente e esgotado, lease/concorrência/replay, sessão salva, UI e executor retomando somente análise com modelo 3.6. Fixtures e transporte simulado não são nova chamada real à Gemini.

[REQUER TESTE MANUAL COM GEMINI REAL] A próxima tentativa da sessão existente. [NÃO VALIDADO] Causa do HTTP 400 anterior e sucesso da integração real após esse diagnóstico. Nenhuma chave, áudio, transcript ou resposta real foi coletada nesta correção. Blocos 6/7 permanecem fora de escopo.

### Reprocessar a sessão que falhou, sem gravar ou transcrever novamente

1. Com a captura já encerrada, recarregue a **mesma instalação** em `edge://extensions`, apontando para a pasta de build que ela já usava (`dist` ou `dist-chunk-test`, ambas regeneradas). Não remova a extensão, apague IndexedDB ou carregue outra instalação/origem.
2. Recarregue a página da sessão. Se necessário, abra pelo popup em **Ver partes e transcrição**; em **Sessões salvas**, selecione a reunião que falhou. Confirme 1/1 transcrita e modelo da sessão `gemini-3.6-flash`. Não altere Settings para tentar mudar essa sessão.
3. Clique **Reprocessar somente as notas** uma vez. Não use gravação nova nem botão de transcrição. Isso autoriza uma nova tentativa de análise e possível cobrança, com texto já salvo. Jobs transitórios ainda em cooldown aguardam automaticamente; o botão aparece para erro terminal.
4. Aguarde. Se concluir, confira notas e persistência. Não há diagnóstico retrospectivo do erro antigo se a nova chamada passar.
5. Se voltar a falhar, abra **Diagnóstico seguro da Gemini** e use **Copiar diagnóstico seguro**. Relate esse texto, o modelo e o status, sem copiar Network/request/headers/prompt/transcrição ou chave. Mensagem desconhecida pode continuar redigida; não declarar causa resolvida sem evidência suficiente. Não repita tentativas indefinidamente.

Arquivos desta correção: novos `src/domain/analysis-diagnostic.ts`, `src/session/AnalysisFailure.tsx`, `tests/analysis-http-diagnostic.test.ts`; alterações em adapter de análise, JobFailure/persistência/retry, protocolo/coordenador/encerramento do executor, página de sessão/mensagem do popup, fronteira mock e respectivos testes. Captura, rotação, SDK/modelos e adapter/parser de transcrição não foram alterados.

## Bloco 5 — implementação pronta para validação manual

[VALIDADO AUTOMATICAMENTE] `npm run typecheck`, `npm run lint`, `npm test` (**183 testes / 22 arquivos**), `npm run build` e `npm run build:chunk-test`. A auditoria dos artefatos valida manifest/permissões, CSP, assets locais, rede Gemini somente no worker, ausência de padrões de secrets/eval/código remoto/fixtures/controles de transcrição de teste em produção. SDK e dependências existentes foram reutilizados; não houve chamada autenticada ou gravação nesta etapa.

Cobertura nova:

- Configurações: três IDs válidos, padrão, ID inválido, migração v1→v2 preservando chave/retenção/idioma, reabertura sem repetir migração e select real nas Configurações.
- Contrato/prompt: quatro perfis, conversa explicativa sem tarefa/decisão, arrays vazios, owner/deadline null, categorias restritas/únicas, falantes ausentes/presentes locais, evidência inexistente/fabricada, atribuições não sustentadas e sugestão rejeitada como decisão. Respostas JSON inválidas/parciais/schema incompatível e status incomplete são rejeitados. SDK real com HTTP interceptado confirma request para cada modelo, schema, store:false, separação da fala maliciosa em input, ausência de tools/áudio/fallback e uma chamada por tentativa. Isso **não prova resistência semântica do modelo real a prompt injection**.
- Pipeline/IDB fake: uma e várias partes; captura ainda ativa e parte final ausente não analisam; análise única; overlap preserva fonte e remove somente tarefas derivadas idênticas; resultado, job e estado são atômicos; falha de validação aborta commit; concorrência de enqueue; lease vencido/generation antiga rejeitados; restart conserva resultado; chave ausente não gasta tentativa; 429/Retry-After, budget de cinco tentativas, retry explícito e falha de modelo preservam texto. Crash na última tentativa não mantém PROCESSING eterno.
- Executor real com transporte simulado: transcreve primeira parte durante gravação; espera STOP e segundo transcript; gera/persiste notas automaticamente, sem botão de análise; WAKE/reimport não repetem chamada concluída. 404 da análise mantém fonte e só retoma após ação, sem retranscrição. Os cliques de autorização de áudio desse teste pertencem ao build de chunks curtos; produção usa orçamento automático ilimitado existente.
- Lifecycle: START fixa modelo; alterar preferência não o muda; transcrição completa continua PROCESSING/preparing; análise leased mostra analyzing; somente notas persistidas permitem COMPLETED; parte ausente produz erro explícito. Migrações IDB v2/v3→v4 conservam fontes, jobs, gravação e reservas do limitador.
- Apresentação/export: somente categorias preenchidas, modelo e citações, owner/prazo ausentes ocultos, resultado vazio legítimo, texto HTML escapado, transcrição integral em details consultável, Markdown/cópia com acentos/títulos/categorias, Blob de download e revogação de URL inclusive em falha. Ouvinte de áudio usa a sessão selecionada.
- Contexto excessivo é bloqueado antes da chamada; estimativa e margem documentadas em ARCHITECTURE. Nenhuma truncagem/hierarquia implementada.

[REQUER TESTE MANUAL COM GEMINI REAL] Primeiro fluxo completo abaixo, aceitação de structured output na chave, fidelidade da extração, sugestão não convertida em decisão, ausência de conteúdo inventado, prompt injection real, overlap parafraseado, clipboard/download e reabertura no Edge. Nenhum dos três interpretadores recebeu chamada autenticada nesta etapa.

[NÃO VALIDADO] Qualidade/custo/latência dos modelos, cotas efetivas do projeto, reuniões grandes reais, novo schema em IndexedDB nativo, lifecycle Edge após morte do executor/offscreen, UI/teclado/Narrator/zoom/contraste reais e causa da metadata ausente na diarização. Diarização **não é bloqueio** do Bloco 5. O ensaio anterior de Edge headless falhou antes de abrir a página; não foi reclassificado como aprovado. Testes automatizados não comprovam ausência universal de alucinações nem exactly-once remoto.

### Primeiro teste completo — dist normal, uma reunião de 2–3 minutos

1. Com nenhuma gravação ativa, execute `npm.cmd run build`. Em `edge://extensions`, recarregue a instalação existente apontando para **dist**, sem remover a extensão nem apagar dados. Registre versão Edge/Windows e data.
2. Abra Configurações, confira a chave preservada e selecione **Econômico — Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`). Opcionalmente mantenha áudio local para conferência. Salve; verifique cota/acesso no link ao AI Studio, sem copiar chave para logs.
3. Abra uma aba com áudio de teste consentido e escolha **Desenvolvimento** ou **Pesquisa** no popup. Inicie e grave por 2–3 minutos, com popup fechado em parte do ensaio.
4. Inclua decisão explícita: “Decidimos usar IndexedDB para guardar os resultados.” Em Pesquisa, use uma decisão metodológica apropriada ao perfil.
5. Inclua tarefa explícita: “Ana vai corrigir o bug até sexta.” Inclua também uma tarefa sem dono/prazo: “Ficou definida a tarefa de revisar os critérios.”
6. Inclua sugestão que não é decisão: “Talvez possamos mudar o tema; isso ainda não foi decidido.” Não mencione referências, prova ou experimentos para preencher categorias.
7. Finalize uma vez. O popup deve mostrar **Preparando suas notas**, com **Ver detalhes**, sem exigir transcrição ou análise manual.
8. Aguarde a transcrição automática. Confira parte(s) e fonte original; falta de falantes identificados deve ser tolerada sem fabricar nomes.
9. Aguarde geração automática. A página mostra **Gerando notas** quando o job está ativo e só anuncia **Notas prontas** após persistir. Não altere modelo durante esse primeiro ensaio.
10. Abra resultado e confira modelo efetivamente usado: `gemini-3.5-flash-lite`. A tarefa sem dono/prazo não deve ganhar atribuições.
11. Confira decisão e tarefa explícitas contra as citações; use **Ver evidência na transcrição → Abrir trecho original**.
12. Confirme que a sugestão não virou decisão/tarefa obrigatória. Verifique categorias ausentes ocultas e nenhuma referência/prazo/responsável inventado.
13. Em **Ver transcrição original**, confira começo/meio/fim e ausência de reescrita. Se reteve áudio, abra **Ouvir partes salvas** para comparar.
14. Recarregue a página e reabra popup/sessão. Notas devem permanecer; não deve haver novo POST de análise para esse resultado. Observe somente contagens/etapas no Network; não exporte conteúdo sensível.
15. Use **Copiar notas**, cole em editor local; **Exportar Markdown**, abra o .md e confira títulos, acentos, categorias e tarefas. Teste também **Copiar transcrição**.
16. Registre passou/falhou por item, modelo, data, duração e mensagens sanitizadas. Restaure retenção desejada. **Somente após esse ensaio** pode ser declarado que o primeiro fluxo de notas foi validado no Edge. Os outros dois modelos podem receber testes curtos separados depois.

Testes adicionais posteriores: 429/offline/chave inválida e retry da análise sem retranscrever; reinício após STOP/lease; reunião com fronteira e tarefa repetida; transcrição com fala maliciosa; sessão parcial mantendo fonte sem notas; sessão vazia; seleção de sessão antiga; recuperação e arquivamento. Não simular falha destrutiva numa reunião pessoal importante. Falha de interpretação não apaga texto; crash antes de commit pode repetir uma chamada remota.

### Arquivos do Bloco 5

Novos: `src/domain/analysis-models.ts`, `src/domain/analysis-input.ts`, `src/domain/notes.ts`, `src/gemini/analysis.ts`, `src/session/NotesContent.tsx`, `src/session/OriginalTranscript.tsx`, `src/session/notes-export.ts`; `tests/analysis-contract.test.ts`, `tests/analysis-pipeline.test.ts`, `tests/analysis-lifecycle.test.ts`, `tests/notes-presentation.test.tsx`, `tests/fixtures/notes.ts`.

Alterados: `src/storage/settings.ts`, `src/storage/recordings.ts`, `src/domain/contracts.ts`, `src/queue/local-worker.ts`, `src/gemini/transcription.ts`, `src/background/capture-coordinator.ts`, `src/settings/SettingsApp.tsx`, `src/session/SessionApp.tsx`, `src/popup/PopupApp.tsx`, `src/components/FoundationNotice.tsx`, `src/components/RecordingStatus.tsx`, `src/messaging/client.ts`, `src/review/review.ts`; `tests/local-worker.test.ts`, `tests/capture-coordinator.test.ts`, `tests/transcription-rate-limit.test.ts`; `scripts/audit-dist.mjs`, `public/manifest.json`, `README.md` e os cinco documentos existentes em `docs/`. `dist` e `dist-chunk-test` foram regenerados separadamente. A pasta continua sem repositório Git; nenhum commit foi criado.

Pendências de Blocos 6/7: polimento/validação visual e acessibilidade; auditoria de release e matriz completa de falhas/custos/captura longa/Edge. Não foram antecipados nesta etapa.

## Bloco 4.1 — evidência e roteiro mínimo

[VALIDADO POR TESTE MANUAL RELATADO PELO USUÁRIO, antes desta etapa] Captura da aba + microfone; popup fechado sem interrupção; partes WebM independentes; overlap; rotação real de ~29m30s; cinco partes transcritas com Gemini, persistência das transcrições e remoção remota. Não invalidar esses resultados com pendências históricas abaixo. Diarização relatada sem metadata: annotations/speakers vazios e interactionId nulo; interjeição de outra pessoa integrada ao texto principal. Isso não comprova a causa.

[VALIDADO AUTOMATICAMENTE] A suíte do Bloco 4.1 cobre primeira admissão imediata, três vagas, quarta adiada, margem e liberação, janela móvel em tempos diferentes, reimport/reopen, migração IDB v2→v3, reservas concorrentes, relógio avançando/retrocedendo, rede/429, Retry-After em segundos/datas/ausente/inválido, jitter e cinco tentativas. Espera local não consome tentativa, libera lease e conserva remoto confirmado. Cleanup e commit local de novo chunk continuam durante espera. Timers/Date controlados: nenhum teste espera minutos reais.

O teste do Dedicated Worker exercita drain, poll, upload/transcrição/persistência/cleanup com transporte simulado e IDB fake: backlog de cinco partes retoma automaticamente após três admissões; uma sexta parte pode ser persistida durante a espera. Como a suíte usa constantes do build de chunks curtos, as cinco autorizações de teste são concedidas de antemão; nenhum clique adicional ocorre para liberar a janela. Produção usa o mesmo drain com orçamento ilimitado. Falha de rede e 429 após upload comprovam reaproveitamento remoto e ausência de retranscrição de fonte já salva. Outro teste encerra e reimporta o módulo do worker conservando IDB e comprova que a quarta parte continua aguardando e depois retoma pelo poll, sem repetir as três completas; isso simula restart e não prova lifecycle do Edge.

O teste HTTP com SDK 2.24.0 real e fetch interceptado verifica serialização do request e propagação de steps/annotations/id de fixture **sintética** do guia oficial; também verifica uma só chamada no 429 e extração real de headers. Testes de diarização cobrem dois IDs, offsets ausentes, annotation sem speaker, estrutura parcial, ausência de annotations, resposta inválida, parser→IDB e UI com/sem speaker. Diagnóstico estrutural é testado contra vazamento de valores. Esses testes não são prova de qualidade ou resposta real do serviço.

[REQUER TESTE MANUAL NO EDGE] Diarização com duas vozes e backlog/restart reais no novo limitador. [NÃO VALIDADO] Causa da metadata ausente anterior, fixture real sanitizada, qualidade de atribuição, limites efetivos TPM/RPD/custos, IndexedDB nativo desta migração e lifecycle completo após morte do executor/offscreen. Não foram feitas chamadas autenticadas nesta etapa nem retranscrições das cinco partes antigas. Bloco 5 não iniciado.

Execução em 17/10/2026: `npm run typecheck`, `npm run lint`, `npm test` (**133 testes / 18 arquivos**), `npm run build`, `npm run build:chunk-test` e o adicional `npm run build:diagnostic` passaram. Auditoria dos três builds confirmou manifest MV3/permissões restritas, assets locais, rede Gemini somente no worker e ausência de padrões de secrets. Builds normais também passaram a proibição de marcador/código de diagnóstico. A estratégia A/B, popup, entrega da chave e permissões não foram modificados. O harness opcional `test:idb:edge` não foi executado nesta etapa; IndexedDB desta mudança foi testado com fake-indexeddb. A pasta não contém repositório Git, portanto não há diff/commit Git disponível.

Arquivos alterados/criados neste bloco (artefatos dist gerados à parte):

- Implementação: `src/queue/transcription-rate-limit.ts`, `src/queue/local-worker.ts`, `src/queue/job-policy.ts`, `src/storage/recordings.ts`, `src/gemini/transcription.ts`, `src/gemini/transcription-diagnostics.ts`, `src/session/TranscriptPart.tsx`, `src/session/SessionApp.tsx`, `src/env.d.ts`.
- Testes: `tests/transcription-rate-limit.test.ts`, `tests/local-worker.test.ts`, `tests/gemini-retry.test.ts`, `tests/diarization.test.tsx`, `tests/gemini-sdk-wire.test.ts`, `tests/fixtures/recording.ts`, `tests/fixtures/transcription-response.ts`.
- Configuração/auditoria: `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `package.json`, `scripts/audit-dist.mjs`, `.gitignore`.
- Documentação: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TEST_PLAN.md`.

### Teste mínimo de diarização — dist normal, uma chamada nova

1. Execute `npm run build`. Com nenhuma gravação ativa, recarregue a instalação existente que aponta para `dist` em `edge://extensions`. Não apague o IndexedDB. Registre versão Edge/Windows e data; confira chave já configurada e cota disponível no AI Studio. Não use as cinco partes antigas como ensaio.
2. Em Configurações, escolha temporariamente **Manter gravação local**. Abra uma aba com uma pessoa consentindo no ensaio e use fones. A segunda voz pode vir dessa aba e a primeira do microfone. Inicie uma gravação nova pelo popup, feche-o e mantenha duas vozes distintas alternando **blocos de 15–25s**, sem sobreposição. Duração total 60–120s, por exemplo A 0–20s, B 20–40s, A 40–60s, B 60–80s. Use fala de teste sem conteúdo sensível. Um “Uhum” isolado não é critério.
3. Finalize. Em `dist`, a parte é transcrita automaticamente; não há botão obrigatório de transcrição. Abra a sessão e espere a parte Transcrita. Confira começo/meio/fim, rawText integral e texto sem reescrita. Ouça o áudio salvo para comparar as duas vozes.
4. Nos DevTools da página de sessão, abra **Application → IndexedDB → meeting-memory → transcripts** e atualize a lista. Selecione a nova parte pelo chunkId, sem confundir com as antigas. Confira `rawText`, `annotations` (word_info), `speakers` e `metadata.interactionId`. Registre somente contagens/presença e IDs sintéticos de falantes; id de interação pode continuar ausente e deve ser relatado. Para aprovar diarização, exija dois speaker IDs em falas longas atribuídas coerentemente; somente a existência de array não basta.
5. Na UI, confira “Parte 1 · Falante …” para os IDs retornados, trechos sem speaker tolerados e fonte integral ainda visível. Não devem aparecer nomes inventados nem identidade compartilhada entre partes. Sem metadata, UI deve mostrar o texto sem fabricar falantes: registre diarização **não validada**. Confira jobs de cleanup COMPLETE e remoteDeleteStatus DELETED sem apagar texto. Restaure a retenção desejada nas Configurações.

### Se faltarem annotations: diagnóstico opcional de desenvolvimento

1. Não retranscreva as partes antigas. Execute `npm run build:diagnostic`. Ele gera `dist-diagnostic` separado; `dist` continua sem diagnóstico. Desative temporariamente a instalação normal e carregue a pasta de diagnóstico como uma instalação de teste separada (chave/configurações/IDB são próprios dessa origem). Configure a chave e keep-local explicitamente. Sem gravação não há envio.
2. Inspecione o contexto offscreen/worker da extensão em `edge://extensions`, selecione o Dedicated Worker nos DevTools quando disponível e abra Console. Repita somente uma gravação nova de duas vozes, 60–120s, como acima. Esse build usa duração normal e transcrição automática.
3. Copie somente a entrada `MM_TRANSCRIPTION_STRUCTURE_DEV_ONLY`: nomes/tipos de campos, stepCount/contentCount/annotationCount/wordInfoCount/speakerCount, hasInteractionId/hasOutputText e campos das primeiras estruturas. Nunca copie key, headers, áudio, URI ou resposta/transcrição integral. O mecanismo não salva resposta bruta. Ausência de step/content/annotations distingue retorno diferente do esperado; contagens positivas com IDB vazio justificam investigar parser/persistência. Diagnóstico do objeto público não prova sozinho o conteúdo do HTTP bruto.
4. Se a estrutura diferir, uma fixture **real sanitizada** precisa ser criada a partir de coleta explícita e controlada, substituindo todo conteúdo por frases fictícias e removendo IDs/URIs/headers/credencial. Não afirmar que uma fixture sintética é real. Se o objeto já não trouxer annotations, registrar ausência de metadata nessa resposta, mantendo a causa aberta; não alterar store:false por tentativa.
5. Ao terminar, desative/remova a instalação de diagnóstico, limpe seu console e volte à instalação normal em `dist`. `npm run build` / `build:chunk-test` auditam que o marcador e a função de diagnóstico não entraram em seus bundles.

### Backlog/restart no Edge — gate separado, sem retranscrever antigos

Em gravação de teste nova, produza cinco partes (em duração normal isso exige várias rotações). Fique offline até haver os cinco jobs pendentes e volte online antes de esgotar as cinco tentativas; a fila não promete retry infinito. Após a conexão voltar, observe no Network somente os POST /interactions: no máximo três em qualquer janela de 60s, demais retomam sozinhos após ~61s ou mais se as chamadas demorarem. Upload e delete não contam como transcrição. Verifique `transcriptionRateLimits` e nextAttemptAt/attempts/lease nos jobs durante espera, sem exportar conteúdo sensível. Reinicie o Dedicated Worker/offscreen apenas em sessão de teste finalizada, preserve IDB e reative/reconcilie pelo coordenador; as reservas devem sobreviver e cleanup deve continuar. Encerrar só o service worker não reinicia o Dedicated Worker. Não recarregue a extensão durante captura. Registre limitações de lifecycle observadas sem invalidar a captura já aprovada.

## Gate do Bloco 2: execução pendente no Edge

Carregar `dist` em `edge://extensions` com **Modo de desenvolvedor → Carregar sem compactação**. Anotar versão em `edge://version`, Windows, microfone e dispositivo de saída. Usar áudio sem informação sensível; uma gravação curta por sessão. Após cada teste, usar **Finalizar gravação** e **Ouvir gravação de teste**. O player e o link de salvamento pertencem só ao diagnóstico deste bloco. Nenhum M-01–M-08 está aprovado por build ou mock.

1. **M-01 — autorização:** na primeira tentativa sobre uma aba de vídeo, verificar a abertura da página visível. Clicar **Autorizar microfone**, conceder, confirmar a mensagem e voltar à aba original. Iniciar novamente. Repetir negando a permissão e depois revogando-a em configurações do Edge; registrar a mensagem e confirmar ausência de captura parcial ou tracks restantes.
2. **M-02 — START e popup:** iniciar na aba da reunião e fechar o popup imediatamente, inclusive durante preparação. Reabrir, confirmar uma só sessão e target correto; tentar iniciar novamente e confirmar que não cria duplicata.
3. **M-03 — duas fontes e saída:** reproduzir fala ou vídeo na aba, falar uma frase distinta no microfone e finalizar. Confirmar que a aba continuou audível, que a própria voz não voltou pelos fones e que o arquivo contém ambas as frases.
4. **M-04 — qualidade:** repetir com fones e, separadamente, alto-falantes; falar simultaneamente ao vídeo. Registrar clipping, eco acústico e inteligibilidade. O grafo impede retorno direto do microfone, mas alto-falantes podem vazar acusticamente ao microfone.
5. **M-05 — alvo e timer:** durante RECORDING, fechar/reabrir popup, trocar de aba e navegar na aba original. Confirmar timer coerente, captura mantida no tabId original e ausência do áudio da nova aba no arquivo.
6. **M-06 — worker:** durante RECORDING, abrir `edge://extensions`, inspecionar o service worker e encerrá-lo. Reabrir popup e finalizar a mesma sessão; repetir sem manter DevTools aberto. Confirmar ausência de nova captura.
7. **M-07 — interrupções:** em ensaios separados, fechar a aba alvo, parar a captura pelo indicador do Edge e desconectar/desautorizar o microfone. Confirmar aviso de interrupção, áudio parcial quando disponível e liberação de tracks/AudioContext.
8. **M-08 — silêncio:** deixar a aba e o microfone silenciosos e aplicar mute temporário. A sessão deve continuar RECORDING; desmutar, produzir som e confirmar conteúdo após STOP.

Registrar para cada caso: passou/falhou, passos exatos, versão Edge, MIME e bitrate mostrados na página de revisão, duração, mensagem de erro e observações. Os testes de adapters usam fontes falsas; ainda falta ensaio com tons sintéticos A/B no Web Audio real e registro completo da gravação no Edge.

Retorno parcial de 01/10/2026: o usuário conseguiu gravar e ouvir o áudio de teste. Não relatou ainda se o arquivo contém aba e microfone, se a aba continuou audível, se houve retorno da própria voz ou se M-01–M-08 passaram. O usuário também observou que faltava iniciar outra sessão após COMPLETED e que as barras de fonte não reagiam; ambas as lacunas foram corrigidas no código. A nova ação **Nova gravação** retorna a IDLE. Barras reais usam AnalyserNode para cada fonte, lido somente enquanto o popup está aberto; este diagnóstico visual ainda requer teste no Edge após recarregar a extensão.

## Classificação obrigatória

- [VALIDADO AUTOMATICAMENTE]: ferramenta estática/documental; declarar exatamente a propriedade medida. Typecheck não valida mídia.
- [VALIDADO POR TESTE]: teste executado com ambiente, entrada, saída e critério de sucesso registrados; explicitar se automatizado ou manual.
- [REQUER TESTE MANUAL NO EDGE]: gate depende do navegador/dispositivo e ainda não possui evidência.
- [NÃO VALIDADO]: hipótese, proposta ou teste ainda não executado.

Registrar versão Edge/Chromium/Windows, extensão/commit, SDK/modelo/API, dispositivos de áudio, data e configurações (sem chave). Anexar logs sanitizados, resultados e limitações. Resultados de fixtures/mocks não provam transporte real ou permissão.

## Estratégia e fixtures

Adapters de mídia, relógio, IDB e transporte permitem ensaiar domínio sem microfone/API. Testes de integração usam IndexedDB real do contexto quando aplicável, além de simulações. API real usa áudio sintético ou consentido, sem materiais pessoais necessários ao teste, chave inserida em runtime e budget limitado.

Fixtures em português: conversa com tarefa explícita sem dono/prazo; sugestão vaga; hipótese; decisão revertida; pesquisa sem experimento/referência; aula sem prova; desenvolvimento sem tarefas; silêncio; fala sobreposta; code-switch; três ou mais falantes; instrução maliciosa dentro da transcrição; conteúdo com HTML/Markdown. Preservar originals e labels por chunk para comparação.

## Testes unitários de domínio

| Área | Casos e oráculo |
| --- | --- |
| Estado | Transições permitidas e proibidas; double START/STOP; retry por etapa; ERROR nunca retoma mídia automaticamente. |
| Contratos | Envelopes malformados, target/sender incorreto, schemaVersion incompatível, valores fora do perfil. |
| Retry | Budget finito, jitter/teto injetados, nextAttemptAt, Retry-After, 401/403 sem loop, 429 de quota e contagem do SDK. |
| Fragmentos | Ordenação, última emissão, empty blob, idempotência, manifest completo antes de enfileirar. |
| Lease | Claim exclusivo, expiração, consumidor antigo sem permissão de commit, resposta tardia descartada. |
| Parser | output_text ausente, annotations ausentes/variáveis, speaker sem offsets, resposta inválida preservada para diagnóstico seguro. |
| Normalização | Ordem por index, fonte byte/textualmente preservada, speakerId repetido entre chunks não unificado. |
| Overlap | Só projeção deduplica trecho inequívoco; ambiguidade mantém fonte e aviso; tarefas não duplicadas inadvertidamente. |
| Análise | Arrays vazios, null, kind único/permitido, referência inexistente, quote não presente, schema inválido e saída truncada. |
| Segurança/export | Não vazar chave, instrução da transcrição não altera política, HTML não executado, arquivo com seções/fonte separadas. |

Não testar apenas espelho da implementação; testar invariantes contra entradas adversas e falhas nas fronteiras de commit.

## Integração

1. IndexedDB: transação abortada, falha de quota, migração, índice único e restart. Pending só existe depois de áudio confirmado; COMPLETED só depois de transcrição persistida. Não manter transação durante rede.
2. START/STOP via mensagens com duas UIs simultâneas; apenas uma reserva/stream/job; resposta perdida e comando repetido não duplicam captura.
3. Recorder real com fonte sintética Web Audio: reproduzir/decodificar cada arquivo completo separado, nunca supor cada fragmento válido; verificar sequência final dataavailable/stop.
4. Crash em cada fase: antes/depois de upload, commit de transcript, enqueue delete e liberação Blob. Reconciliar sem apagar material necessário; delete falho não repete transcrição.
5. API: upload Blob WebM no ambiente alvo, get até disponibilidade, Interactions com diarização sem word timestamps, parse da resposta real, persistência e delete; store:false e schema de análise verificados. Não reutilizar snippet Node.
6. Rede lenta e offline com fila crescendo: recorder continua; consumo de memória/IDB não cresce pela acumulação em RAM de toda reunião. Meta inicial de concorrência um job; medir impacto de SDK, decode e assembly.
7. Executor separado: concluir jobs após STOP com popup e resultado fechados; matar executor/offscreen e recuperar lease. Se falhar, validar fallback de página visível e ajustar documentos antes de avançar.
8. Análise completa: os quatro perfis com mesmo pipeline, rendering/export de arrays vazios, labels locais e evidência; reanálise funciona quando Blob foi descartado.
9. Transcrição acima do orçamento de contexto: nenhuma truncagem silenciosa, caminho explícito e qualidade de extração/consolidação; gate DEC-013.

## Testes manuais no Edge

Todos abaixo estão [REQUER TESTE MANUAL NO EDGE]. Usar instalação Load unpacked real; não concluir a partir de Chrome ou navegador automatizado genérico.

| ID | Ensaio | Aceite observável |
| --- | --- | --- |
| M-01 | Primeira permissão, negada, revogada e microfone ocupado | Onboarding utilizável; ambas fontes ou início abortado; sem tracks órfãs. |
| M-02 | START do popup, fechamento durante STARTING | Target correto, gesto aceito e resultado reconciliado sem dupla sessão. |
| M-03 | Reunião em aba, microfone e reprodução | Outras vozes e usuário presentes; reunião audível; sem voz própria roteada à saída. |
| M-04 | Headphones e alto-falantes, clipping e fala simultânea | Medir qualidade e eco acústico; diarização incerta não apresentada como identidade confiável. |
| M-05 | Fechar/reabrir popup, trocar aba e navegar | Captura continua no target; estado/timer corretos; não capturar aba nova. |
| M-06 | Worker encerra/reinicia, inclusive DevTools fechado | Offscreen continua e comando finaliza sessão existente. DevTools pode alterar lifecycle, repetir sem ele. |
| M-07 | Fechar reunião/parar stream/desconectar microfone | Interrupção explícita, último arquivo salvo quando possível, resources liberados. |
| M-08 | Silêncio prolongado e mute da reunião | Não confundir silêncio com encerramento; offscreen não depende de áudio fictício. |
| M-09 | Rotação 10/20s, pelo menos duas fronteiras | Arquivos independentes, sequência sintética preservada e overlap rastreável. |
| M-10 | Rotação real de 29m30s por pelo menos três chunks | Validar duração real de todos arquivos e upload com diarização dentro do limite. |
| M-11 | STOP antes/durante/depois de rotação | Sem perder último fragmento, jobs duplicados ou falas omitidas sem aviso. |
| M-12 | CPU intensa, aba em background, minimizado | Medir atraso/overshoot; arquivo acima de limite bloqueado; sem promessa de continuidade não provada. |
| M-13 | Suspensão/bloqueio, reinício Edge e offscreen morto | Dados disponíveis recuperados; lacunas informadas; não retomada silenciosa de mídia. |
| M-14 | Offline/timeout/429/5xx/chave inválida | Captura desacoplada; retries limitados; ação útil para erro permanente. |
| M-15 | Disco/quota/IDB indisponível | Não apagar pending; parada segura e aviso claro se salvar próximo áudio é inviável. |
| M-16 | Transporte no contexto extensão/worker | SDK, CORS, CSP, upload, parsing, delete e store:false reais; sem credencial em logs. |
| M-17 | Popup/settings/result com teclado e Narrator | Foco visível, labels, fase anunciada sem timer falante, controle Finalizar alcançável. |
| M-18 | Zoom 200%, reduced motion, contraste e textos longos | Reflow sem corte, estado não só cor, animação reduzida e contraste medido. |
| M-19 | Cópia e Markdown em apps locais | Unicode/acentos, perfil, metadados, fonte, notas e incompletude preservados. |
| M-20 | Local default-delete e keep-audio | Pending/error preservados; completo deletado só após commit; trade-off explicado. |

## Gate especial de fronteira e duração

Fonte sintética contém marcadores sonoros e frases numeradas contínuas ao redor das fronteiras. Comparar sinal decodificado A/B e sequência de frases, além de ouvir. Evento start não é evidência suficiente. Teste deve detectar amostras/trechos ausentes e duplicações, inclusive STOP durante overlap. Registrar duração medida, começo/fim observado e erro de relógio. Aceite: nenhum marcador/frase ausente sem indicação de falha, arquivos válidos isoladamente e nenhuma remoção ambígua da fonte. Qualidade em fala real complementa sinal sintético.

Se a duração não puder ser medida automaticamente com confiança, registrar `measuredDurationMs = null` e impedir uso futuro de um arquivo potencialmente acima do limite sem verificação adicional. A validação manual de rotação consolida DEC-005 somente como estratégia de captura do MVP no Edge testado; elegibilidade para API externa continua gate separado. Reduzir alvo pode aumentar margem, mas não fornece garantia absoluta. Não adulterar metadata nem enviar silenciosamente um arquivo incompatível.

## Matriz de edge cases

| Cenário | Estado/material esperado | Recuperação |
| --- | --- | --- |
| Duplo iniciar / STOP repetido | Uma sessão / uma finalização | Resposta idempotente, snapshot atual. |
| API indisponível durante gravação | RECORDING, chunks PENDING | Rede retoma dentro do budget/ação explícita. |
| Upload respondeu mas commit perdeu nome | Possível arquivo remoto órfão | Guardar diagnóstico sem prometer exactly-once; não deletar arquivos alheios. |
| Remoto expirou | Blob presente ou transcript salvo | Reupload se necessário; texto completo dispensa novo upload. |
| Transcrição salva, delete falhou | Chunk COMPLETED, limpeza pendente | Repetir somente delete. |
| Áudio removido, análise falhou | Fonte em texto intacta | Reanálise, sem prometer retranscrição. |
| Recorder morreu no meio | Fragmentos salvos podem ser inválidos | Tentar recuperação, informar parte perdida. |
| Fonte muda/mute temporário | Observar track e contexto | Não adivinhar encerramento por silêncio. |
| Chunk >30min ou formato inválido | ERROR, Blob retido | Gate/resegmentação futura explícita; não retry igual. |
| spk_1 em dois chunks | Identidades separadas | Mostrar parte + falante; não nome global. |
| Mais de oito falantes / três ou mais | Qualidade não garantida | Aviso de limitação; jamais identificação falsa. |
| Transcrição vazia | Resultado vazio legítimo se áudio válido | Sem categorias inventadas; distinguir falha do transporte. |
| Texto manda ignorar instruções | Dados não confiáveis | Nenhum tool/exec; política de extração mantida. |
| Sessão longa além de contexto | Fonte inteira preservada | Preflight e caminho DEC-013, sem truncar. |
| Incógnito/reload/update extensão | Suporte a incógnito não definido, proposta de restringir uso inicial ao perfil normal | Confirmar escopo antes de suporte; não prometer continuidade de reload/update e reconciliar após. |

## Aceite por bloco futuro

| Bloco | Entrega e gate |
| --- | --- |
| 1 — Fundação | Build local MV3, entrypoints corretos, assets locais/CSP, settings e estados mock; carregar no Edge. Nada de afirmar captura real. |
| 2 — Captura | M-01–08: duas fontes, saída correta, popup independente, parada limpa; decisão de versão/permissão resolvida. |
| 3 — Chunking/IDB/fila | Arquivos independentes e fronteiras verificadas, persistência/crash/quota, retry/leases e duração real; DEC-005/007 aprovados ou revisados. |
| 4 — Transcribe | API autenticada com Blob real, SDK fixado, pt-BR/verbatim/diarização, resposta fixture, retomada e delete sem perda. |
| 5 — Análise | Schema/Zod, evidência/ausência, quatro perfis, transcrição imutável, contexto longo resolvido; export funcional. |
| 6 — UX | Todos estados úteis, categorias vazias ocultas, design/contraste/teclado/Narrator/zoom/motion validados. |
| 7 — Auditoria/RC | Reunião real e M-10–20, falhas/retenção/secrets/CSP, documentação atualizada e nenhuma pendência crítica de captura/fonte. |

## Auditoria desta etapa documental

Os cinco documentos foram relidos e comparados quanto a escopo, estados, retenção, propostas e fontes. Exemplos permanecem contratos futuros, sem código de produto. [VALIDADO AUTOMATICAMENTE]: existência dos cinco arquivos, resolução dos links Markdown locais e fechamento dos code fences, por verificação PowerShell em 01/10/2026. Diagramas Mermaid não foram renderizados. Nenhum teste de produto ou chamada autenticada foi executado; mídia/API continuam [NÃO VALIDADO].

## Histórico: evidência do Bloco 1 — Fundação

Gate identificado: “Build local MV3, entrypoints corretos, assets locais/CSP, settings e estados mock; carregar no Edge. Nada de afirmar captura real.” O gate automático foi executado, enquanto carregamento e interação no Edge aguardam confirmação do usuário.

Ambiente automático: Windows, Node 22.23.2, npm 11.1.0, dependências diretas/lockfile conforme DEC-019, em 01/10/2026.

- [VALIDADO AUTOMATICAMENTE]: instalação limpa `npm.cmd ci --offline --no-audit --no-fund`, typecheck estrito, lint sem warnings, builds `dist` e `dist-dev` e auditoria dos artefatos.
- [VALIDADO AUTOMATICAMENTE]: `npm.cmd run dev -- --port 5173 --strictPort` iniciou o servidor; os três HTMLs popup/settings/session responderam HTTP 200. O servidor foi encerrado após o smoke test. Isso não valida renderização/interação no navegador.
- [VALIDADO POR TESTE]: 50 testes Vitest em seis arquivos. Máquina de estado/fluxo nominal/invalid transitions/double START/STOP/recovery, perfis, boundaries/protocolo/sender, settings/defaults/validação/restrição de acesso, filtro de seções vazias, renderização estática de cenários, coordinator revision e worker com storage adapter.
- Teste de restart reimporta o módulo do worker com storage em memória preservado. Prova reconciliação da lógica, não suspensão/restart real no Edge.
- Auditoria do build verifica manifest MV3, permissões mínimas, entrypoints, referências HTML/imports ESM locais, CSP, ausência de eval/dev server/mídia/transporte cloud, exclusão de conteúdo fixture do normal e padrões comuns de secrets. URLs de namespace DOM, links inertes de erro React e strings de schema/parser Zod não são recursos remotos carregados; o auditor possui allowlist explícita para essas strings.
- [REQUER TESTE MANUAL NO EDGE]: Load unpacked, popup/settings/session, salvar/recarregar preferências, restrição real de storage, fechamento/reabertura, console e worker sem DevTools. Passos exatos em README.
- [NÃO VALIDADO]: aparência/contraste/zoom/leitor de tela reais; offscreen em execução (somente artefato empacotado). Não foi criado offscreen porque não há motivo de mídia neste bloco.
- [HISTÓRICO DO BLOCO 1]: captura/microfone/tabCapture/Web Audio/MediaRecorder/chunking/IDB de áudio/fila ainda não estavam implementados nessa etapa; Blocos 2–3 os acrescentaram. Gemini/transcrição/prompts/análise/export final/retry de rede continuam futuros.

Scripts de qualidade do Bloco 1 não representam teste de captura. Desde o Bloco 2, o build normal oferece captura real para o gate manual; o build de simulação permanece identificado como desenvolvimento.

Revisão final: todos os arquivos adicionados e as alterações dos cinco documentos foram inspecionados; a pasta não possui repositório Git, portanto não houve diff Git disponível. Scan de fonte não encontrou TODO/FIXME, código de mídia/transporte em src nem credencial real. URLs de example.org nos testes são entradas negativas de validação de origem. Nenhuma proposta dos blocos futuros foi consolidada por consequência do build.

## Evidência informada pelo usuário — teste principal do Bloco 2

[VALIDADO POR TESTE MANUAL RELATADO] Áudio da aba capturado; microfone capturado; aba permaneceu audível; microfone não foi monitorado na saída; arquivo final reproduzível; popup fechou/reabriu mantendo captura. O usuário não confirmou versão do Edge, primeira permissão, revogação, interrupções ou qualidade de fronteira.

## Gate do Bloco 3 — roteiro Edge

1. Execute npm run build:chunk-test, recarregue a extensão Load unpacked apontando para dist-chunk-test e abra uma aba com áudio. Inicie, grave 35–45 s e finalize. Na página de revisão, espere 4–5 partes, baixe cada WebM e abra cada arquivo isoladamente. Anote MIME, tamanho e duração exibida. Se qualquer arquivo depender do anterior, falhou o gate.
2. Repita com fala contínua contando números na fronteira de 10 s: “oito, nove, DEZ, onze, doze”. Ouça o fim de uma parte e o início da seguinte. Registre ausência, duplicação e ordem; duplicação no overlap é aceitável apenas se documentada. Use o tempo exibido como aproximação, não prova de alinhamento.
3. Grave vários chunks com popup fechado. Reabra e confira contagem e reprodução. Faça STOP antes do overlap, durante o segundo 9–10 e logo depois do segundo 10, em sessões separadas. Confira índices únicos, último áudio salvo e nenhuma parte vazia.
4. Com captura ativa, reinicie o service worker pela página de extensões e reabra o popup; não recarregue a extensão, pois isso encerra o offscreen. Após STOP, reinicie o service worker e confira jobs/chunks no IndexedDB e status final. Observe se offscreen e Dedicated Worker permanecem apenas enquanto há captura ou jobs.
5. Se houver condição segura de simular quota, registre estimate() e provoque falha de escrita em perfil de teste. Verifique parada com mensagem e preservação de partes anteriores; nunca apague PENDING/ERROR para liberar espaço.
6. Recarregue a extensão apontando para dist de produção e grave alguns minutos. Para validar DEC-005 em duração real, faça pelo menos uma rotação de cerca de 29m30s e confira os dois WebMs isoladamente; no gate completo, prefira três partes reais.

[HISTÓRICO ANTES DO ENSAIO EDGE] Typecheck, lint, build normal e 75 testes Vitest passaram em 01/10/2026. O teste de rotação usava MediaRecorder fake e clock virtual. Naquele momento, WebM independente, gap, duplicação, quota, RAM longa, duração WebM real e lifecycle do executor ainda não tinham evidência; os resultados manuais posteriores estão abaixo. DEC-007 permanece proposta.



Tentativa adicional em 01/10/2026: `npm run test:idb:edge` prepara um harness para IndexedDB nativo e cobre schema, índice único, abort, reopen, fragmentos, lease/generation. Neste ambiente automatizado o Edge headless encerrou antes de executar a página (`GPU process isn't usable`), mesmo com GPU desabilitada. [NÃO VALIDADO] Esse harness deve ser executado em um Edge funcional; sua existência não conta como teste passado.

## Evidência manual recebida — fronteiras do Bloco 3 (01/10/2026)

[VALIDADO POR TESTE MANUAL RELATADO PELO USUÁRIO] Chunks curtos de ~10s reproduzíveis isoladamente; overlap perceptível de ~1s, sem perda audível; várias rotações consecutivas com popup fechado; STOP antes da primeira rotação e logo após rotação; último chunk parcial salvo. Em duração de produção, Parte 1 00:00→29:30 e Parte 2 29:29→31:16 abriram isoladamente. O overlap observado foi ~1155ms, com repetição esperada e sem perda perceptível de fala na fronteira. A evidência sustenta DEC-005 para o MVP no Edge testado; não prova comportamento universal, ausência de gaps subaudíveis ou compatibilidade em outras máquinas. Deduplicação textual ainda não existe e “duração não medida” continua limitação do método automático.

## Hardening curto do Bloco 3

[VALIDADO POR TESTE] Testes com relógio e recorder fake forçam ordem inversa dos eventos de stop, ordem inversa dos commits, STOP durante overlap e logo depois. A metadata usa stop observado do predecessor mesmo quando a finalização do sucessor chega primeiro; primeiro overlap é 0 e nenhum valor é negativo. Testes de política cobrem lease renovável, owner/generation inválidos, expiração, claim por outro executor, backoff, máximo de tentativas e falha permanente. Testes com timers falsos verificam remoção do heartbeat após sucesso, falha e abort.

[VALIDADO AUTOMATICAMENTE] `npm run typecheck`, `npm run lint`, `npm test` (85 testes em 11 arquivos), `npm run build` e `npm run build:chunk-test` passaram após o hardening. A auditoria dos bundles confirmou ausência de transporte externo e que a duração curta não entrou no build normal. Manifest e permissões permaneceram os mesmos.

[REQUER TESTE MANUAL] Lifecycle do Dedicated Worker após STOP e reinício real do service worker; retomada de lease expirado nesse ambiente; quota e RAM em gravação longa; duração WebM automática. DEC-007 não foi consolidada. A tentativa anterior de usar Edge headless neste ambiente falhou antes da página abrir, por erro do processo gráfico, então o harness nativo IDB continua sem resultado.

## Gate do Bloco 4 — Gemini real

1. Rode `npm run build:chunk-test`, carregue `dist-chunk-test` no Edge, configure sua chave Gemini nas Configurações e escolha temporariamente **Manter gravação local** para facilitar conferência do áudio. Esse build não envia nenhuma parte sem clique explícito.
2. Abra uma aba com conversa de duas vozes, inicie a captura, grave 30–60 segundos e finalize. Na página da sessão, clique **Transcrever uma parte de teste** uma vez. Espere a Parte 1 ficar Transcrita. Confira texto PT-BR, falantes locais, fonte bruta e status. Não exija diarização perfeita; registre troca ou ausência de falante.
3. Confirme que o arquivo remoto foi apagado quando observável no painel/API. Se houver falha de delete, a transcrição deve continuar disponível e o cleanup deve aparecer pendente/erro no IDB. Confira `store:false` por inspeção de request no teste local e, se possível, Network do Edge; não confunda isso com ausência total de retenção do provedor.
4. Ainda em `dist-chunk-test`, grave 25–35 segundos para gerar 2–3 partes. Clique uma vez por parte. Verifique índices em ordem, todos os textos, fala da fronteira e repetição esperada por overlap. Não apague texto repetido da fonte.
5. Teste sem chave, chave inválida, offline, 429 quando possível, restart do service worker após STOP e após upload, popup fechado, e preferência de retenção. Confira que tentativas sem chave não se esgotam, áudio de falha fica local, transcript salvo não é retranscrito e cleanup não apaga texto.
6. Só depois, recarregue `dist` de produção. A transcrição normal é automática após cada chunk. Para qualquer gravação longa, confirme custo/quota e a validação de 29m30s no modelo real antes de considerar o gate concluído.

[VALIDADO AUTOMATICAMENTE] Tipos do SDK, chamada do adapter com config explícita, serialização HTTP com `store:false`, parser com annotations parciais, commits IDB/lease/stale generation, política de retry e auditoria de build. [REQUER TESTE MANUAL COM GEMINI REAL] todos os passos acima; não foram executados automaticamente porque dependem de chave e cobrança. [NÃO VALIDADO] acesso da chave ao modelo, resposta real, CORS/CSP, delete remoto efetivo, compatibilidade de WebM da API, qualidade de speaker labels, limites de custo, duração longa e lifecycle Edge.

Primeiro ensaio Gemini relatado pelo usuário: `dist-chunk-test` mostrou quatro partes, todas com HTTP 404 e zero transcrições. O relato prova que o caminho chegou a uma resposta HTTP da API, mas a versão inicial da UI não registrou a etapa nem o código semântico do erro; não conclui se faltou acesso ao modelo ou se o arquivo remoto não foi encontrado. Não repetir as quatro partes automaticamente. O SDK 2.24.0 foi verificado em teste de wire usando `/v1beta/interactions`, como no exemplo oficial. A versão de diagnóstico mostra se o upload foi confirmado, preserva áudio local, agenda limpeza dos uploads de jobs encerrados e permite repetir explicitamente só uma parte. O próximo ensaio deve registrar etapa, código seguro (`model_not_found` ou `not_found`, quando fornecido) e resultado de uma única repetição.

Segundo ensaio: partes 1 e 4 mostram HTTP 404 **durante upload**; partes 2 e 3 continuam aguardando. A inspeção do SDK 2.24.0 revelou que passar `config.httpOptions` ao `files.upload` substitui as opções especiais da iniciação resumível. Nossa configuração anterior, usada só para limitar retries, removia `apiVersion:''` e os headers `X-Goog-Upload-*`; o endpoint resultante incluía `/v1beta/upload/v1beta/files`. A correção remove `httpOptions` do upload, preservando o comportamento padrão do SDK. Teste de wire interceptado verifica `/upload/v1beta/files`, `X-Goog-Upload-Protocol: resumable`, `X-Goog-Upload-Command: start`, tamanho e MIME. Próximo ensaio real: reconstruir `dist-chunk-test`, recarregar a extensão e repetir explicitamente **uma parte com 404**. Verificar se aparece upload confirmado e se a etapa seguinte conclui; não disparar as partes restantes sem observar o resultado.

Terceiro ensaio: 4 de 5 partes transcritas; a Parte 5 recebeu HTTP 429 na etapa de transcrição, com upload confirmado. Isso valida transporte real e resposta real de transcrição para as quatro primeiras partes, mas não fecha o gate de recuperação do 429 nem de limpeza remota. No `dist-chunk-test`, cada clique fornece orçamento para uma tentativa; o botão de teste agora também aparece para um job com erro recuperável quando chega `nextAttemptAt`. A próxima tentativa da Parte 5 deve ocorrer após verificar a cota do projeto no AI Studio e esperar a janela aplicável. A identidade remota já salva evita novo upload nessa tentativa.

Execução local após o diagnóstico: `npm run typecheck`, `npm run lint`, `npm test` (95 testes em 14 arquivos), `npm run build` e `npm run build:chunk-test` passaram. A auditoria dos dois bundles confirmou host permission restrita, CSP sem scripts remotos e nenhum padrão de chave embutida.


