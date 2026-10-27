# Meeting Memory — evolução histórica da arquitetura

> Registro evolutivo por blocos. Para a descrição atual, consulte [ARCHITECTURE_CURRENT.md](ARCHITECTURE_CURRENT.md); o [índice](README.md) separa instruções atuais de relatos históricos. Links para `.verification/` são locais e não integram o repositório público. As decisões abaixo foram preservadas.

## Reuniões e armazenamento — implementado em 20/10/2026

A biblioteca consulta metadados primeiro e mede conteúdo por cursores, no máximo 100 registros por transação readonly. Usa somente Blob.size, sem decodificar ou reunir áudios; texto UTF-8 e metadados são estimados separadamente. A quota vem de navigator.storage.estimate() e não equivale à soma de conteúdo nem ao espaço livre no disco.

REMOVE_RECORDING_AUDIO e DELETE_RECORDING usam schemas/respostas separados, remetente restrito à biblioteca e revisão esperada do snapshot. O background usa a fila serial existente. mutateMeeting revalida gravação/jobs na própria transação readwrite; remoção de áudio exige transcrição persistida e limpeza remota concluída, pelos mesmos critérios de releaseAudio.

IndexedDB v5 acrescenta meetingDeletions (recordingId, deletedAt). Exclusão por reunião grava o marcador, remove conteúdo/fragmentos/sessão ativa e preserva/cria jobs de limpeza remota conhecidos atomicamente. Writers, claims, retries, commits e reconciliação consultam o marcador; só jobs de limpeza podem continuar. A conclusão de limpeza elimina o job da reunião excluída. O marcador mínimo permanece para rejeitar respostas atrasadas, sem reintroduzir a reunião na lista.

Chrome storage e IndexedDB não têm transação conjunta: após commit o snapshot é limpo; GET e atualização de credenciais reparam um snapshot antigo pelo marcador após interrupção. BroadcastChannel avisa outras páginas; a sessão mantém seu polling e revoga URLs de áudio ao receber mudanças. Manifest, CSP, permissões, dependências, captura e transporte Gemini preservados. [Detalhes, evidências e limites](MEETING_MANAGEMENT.md). As descrições abaixo registram entregas anteriores.

## Atualização 6B.2 — apresentação de resultados

`SessionApp` resolve `recordingId`, fixa a resolução das URLs antigas e conserva o seletor atual. `useSessionData` lê dados existentes; `SessionResult` organiza cabeçalho, abas e recuperação. Notas são documento contínuo e fontes navegam/focam a parte correspondente da transcrição. `AudioParts` usa `getChunk` somente para a seleção solicitada e revoga URLs no ciclo de vida. A enumeração de partes usa openKeyCursor readonly no índice v4 `recordingIndex`; nenhum Blob é materializado para listar partes. Domínio, storage, mensagens, worker, Gemini, manifest e exportação estão preservados. [Detalhes e evidências](BLOCK_6B2_RESULTS.md). Sem biblioteca ou novos comandos duráveis.

## Camada visual 6B.1 — fronteira de escopo

Tailwind CSS com plugin Vite compila CSS local; shadcn/ui é código React local em `components/ui`, com Radix Slot/Tabs/AlertDialog e Lucide React seletivo. Configuração, tokens e compatibilidade estão documentados em [BLOCK_6B1_FOUNDATION.md](BLOCK_6B1_FOUNDATION.md). Não há Preflight; estilos antigos são uma camada inferior explícita. A galeria de componentes só é entrada em foundation-mock, nunca no dist normal.

Nenhum módulo de captura, rotação, armazenamento, fila, transporte, modelo, prompt ou contrato foi alterado por esta fundação. Bootstrap `ui-csp` é importado primeiro nas páginas React e revisão para configurar somente o contexto visual com Zod jitless; o executor/offscreen/service worker não o importam. Validação continua com os mesmos schemas. CSP e permissões do manifest não são ampliadas. Mudanças de nomes de chunks por recompilação não implicam alteração de contratos.

Base documental de 01/10/2026, atualizada até o Bloco 5 em 17/10/2026. As seções recentes substituem propostas e pendências históricas abaixo. Captura/rotação/transcrição já confirmadas pelo usuário permanecem válidas. Notas estão implementadas com testes locais; a análise real no Edge, quota/duração automática e lifecycle completo após restart continuam abertos. SDK fixado em 2.24.0.

## Implementação do Bloco 5 — contratos e integração (17/10/2026)

**Revisão mais recente após evidência real:** ensaio Lite aceitou TEXT_ONLY/JSON_ONLY/OUTPUT_LIMIT/MINIMAL_SCHEMA e rejeitou somente NOTES_SCHEMA com 400 genérico. A configuração do schema completo é o gatilho isolado; keyword/limite interno e causa do primeiro 400 no Flash continuam não identificados. Produção usa agora JSON sem `response_format.schema`, com contrato textual nas instruções e validação local completa inalterada. Prompt v2, notas schema v1, compatível com notas históricas de prompt v1. Preflight conta o contrato dentro das instruções. O teste sintético mantém o schema anterior para diagnóstico e não gera notas.

**Escolha manual de Lite em sessão existente:** RETRY_ANALYSIS aceita analysisModel opcional literal `gemini-3.5-flash-lite`. Após as mesmas verificações de fonte/resultado/terminal/lease, registra Job.analysisModelOverride no mesmo job canônico. Worker usa override para a chamada; persistNotes registra o modelo efetivo. Recording.analysisModel continua sendo a escolha original usada na identidade estável do job, impedindo duplicações na reconciliação. Override sobrevive a falha/restart; botão genérico posterior conserva a escolha explícita. UI oferece **Reprocessar notas com Lite** e mostra modelo escolhido para reprocessamento. Não é fallback nem migração automática de sessão. Fonte e preferências não são alteradas. Estes parágrafos e o relato mais recente de TEST_PLAN substituem os contratos históricos abaixo quanto ao schema remoto e à possibilidade de escolha manual de modelo.

Preferência posterior explícita do usuário: **Lite como padrão**. Settings schema v3, ainda na chave `settings-v1`, migra v1/v2 para `gemini-3.5-flash-lite` uma única vez, preservando API key, idioma e retenção. Preferências escolhidas depois em v3 são respeitadas. O modelo fixado em sessões existentes não é alterado; a migração afeta próximas gravações. Teste de regressão cobre preservação e aplicação única.

Correção pontual posterior ao primeiro ensaio real: HTTP 429 seguido de 400 na análise com 3.6. Causa do 400 ainda desconhecida; request/schema/modelo/SDK mantidos. `domain/analysis-diagnostic.ts` projeta code/message do SDK em vocabulário técnico fixo (valores desconhecidos omitidos), sem guardar erro/body/headers/prompt. `failJob` conserva `lastAnalysisDiagnostic` apenas para análise, sem migração IDB necessária. HTTP 400 tem mensagem própria e não implica problema de chave. `retryAnalysis` permite retry explícito de terminal PERMANENT/esgotado no mesmo job, com fonte completa, sem resultado/lease ativo e sem antecipar backoff transitório. Novo comando RETRY_ANALYSIS e botão **Reprocessar somente as notas** atendem também sessões salvas; fechamento do offscreen respeita pendências de todas as sessões. Nenhuma mudança de captura/transcrição ou fallback. Evidência e procedimento estão no início de TEST_PLAN; sucesso remoto ainda não validado.

Após confirmar mensagem real genérica sem fieldViolations, PROBE_ANALYSIS permite um teste técnico explícito em modo `analysisProbe` no mesmo job. Por autorização do usuário, novos ensaios v2 usam exclusivamente `gemini-3.5-flash-lite`, com modelo/versão persistidos no ensaio, sem modificar o modelo original da sessão. Cinco etapas: TEXT_ONLY (somente model/input/store:false), JSON_ONLY, generation_config, schema mínimo e schema real. A primeira transição também altera texto/instrução, portanto não identifica isoladamente um campo rejeitado. Não há acesso ao texto da reunião nesse ramo do executor. Usa leases existentes, salva progresso entre etapas com nextAttemptAt >=61s e limita a cinco claims inclusive crash; falha encerra imediatamente, sem retry automático. Ensaios v1 mantêm índices/limite de quatro claims; se ativos, encerram sem chamada externa para não consumir Flash. Resultado técnico nunca gera notes/COMPLETED nem retoma análise real por conta própria. Campos opcionais em jobs dispensam migração. Detalhes e limites de interpretação no início de TEST_PLAN. O pipeline normal de análise permanece igual até existir evidência de um campo incompatível.

Inspeção prévia preservou: quatro perfis em domain/profiles; gravação A/B e CaptureSession; snapshot em storage.local e protocolo v1 com revision; IDB v3 e transcrições; fila única com lease 60s/heartbeat 20s/generation, cinco tentativas e limitador de transcrição; Settings v1; popup e página de sessão. Não há novo sistema de filas ou mudança no transporte de áudio.

- `domain/analysis-models.ts`: allowlist dos três IDs, padrão Flash-Lite e limites documentais por modelo. Settings passa a schemaVersion 2, mantendo a chave local `settings-v1`; migração valida v1 e preserva API key, idioma e retenção antes de salvar v2. Recording.analysisModel é fixado em START, sem credencial. Registros antigos não ganham modelo nem chamada remota implicitamente.
- `domain/analysis-input.ts`: verifica captura encerrada, completeness COMPLETE, ausência de interrupção, número e sequência exatos de chunks, correspondência de cada transcript. Produz JSON com partes ordenadas, rawText integral, overlap e falantes locais quando presentes. Não precisa de áudio nem speaker labels. Instruções do sistema ficam separadas dos dados não confiáveis. Dados nunca controlam request, endpoint, modelo, schema ou tools.
- `gemini/analysis.ts`: adapter independente `GeminiAnalysisClient`/`GoogleGeminiAnalysisClient`. SDK local usa Interactions `response_format:{type:'text',mime_type:'application/json',schema:...}`, `system_instruction`, `store:false`, retries internos desabilitados, sem tools/grounding/search/previous interaction/background. Exige status completed, JSON válido e validação local. Não reenvia áudio.
- `domain/notes.ts`: schema Zod/JSON Schema por perfil. Output = title nullable, summary:NoteItem[], sections:{kind,items}[], tasks:{description,owner,deadline,status:'defined',evidence}[]. NoteItem = text, nature established/suggestion/hypothesis, evidence:{chunkId,quote}[]. Arrays vazios são válidos. Kind é allowlist e único, Aula não admite tarefas, decisões não admitem sugestões/hipóteses. Citações são substrings literais de rawText da parte citada; owner/deadline não nulos precisam constar na evidência. Isso não é um verificador semântico de veracidade. O schema enviado usa nullable como type array e literais como enum; remove $schema/minLength/maxLength do request para usar o subconjunto documentado. Zod conserva todas as restrições localmente.
- Resultado local = recordingId, profile, analysisModel, schemaVersion:1, promptVersion:1, createdAt, sourceKey, output. sourceKey é a lista ordenada de identidades/índices/createdAt dos transcripts imutáveis, sem texto. Campos brutos do modelo não podem alterar esses metadados locais.
- IDB **v4** adiciona somente `results` (keyPath recordingId); stores anteriores são preservados. Job `analyze:<recordingId>:<modelo>:v1` usa a fila existente. Política V1: um único resultado final por sessão, modelo fixado e contrato v1; resultado válido nunca é sobrescrito nem reanalisado automaticamente.
- `enqueueAnalysis` transacional checa fontes completas e existência de job/resultado antes de criar. O executor reconcilia em cada drain; coordenador também reconcilia após STOP/GET. Persistência revalida fontes, perfil, evidência e owner/generation/lease. Notas, job COMPLETE e Recording COMPLETED têm **um commit atômico**. Snapshot público só anuncia conclusão após leitura do resultado comprometido. Falha/abort/schema inválido não produz COMPLETED.
- API key ausente aguarda credenciais sem gastar tentativa; 401/403/404 pedem ação. Offline/5xx/JSON/schema/evidência inválidos usam budget existente de cinco tentativas; 429 respeita Retry-After e espera pelo menos 61s. Apenas códigos fixos JSON/SCHEMA/EVIDENCE/INCOMPLETE e mensagens sanitizadas ficam no erro; nenhum output, fonte ou chave em logs. Lease abandonado na última tentativa vira ERROR após expiração, evitando PROCESSING eterno. Retry explícito retoma análise sem retranscrever; modelo nunca muda por fallback.
- Recuperação após executor reiniciado usa IDB e lease; reabrir popup/sessão reconcilia e recria offscreen se houver trabalho. Não acrescenta alarms nem keepalive artificial. Após resultado persistido, restart não chama análise novamente. Crash/timeout **antes do commit** ainda pode causar repetição/cobrança externa: não há exactly-once remoto. Lifecycle real do Edge continua gate manual.

### Overlap e orçamento de contexto

Não há edição/deduplicação da fonte. Limites das partes e overlap são enviados; prompt pede um fato por repetição de fronteira. Validação só colapsa itens/tarefas derivados exatamente idênticos; repetições parafraseadas dependem do modelo e revisão manual.

As fichas oficiais consultadas em 17/10/2026 indicam entrada 1.048.576 e saída 65.536 tokens para os três modelos, com structured outputs. O preflight usa bytes UTF-8 do sistema + input JSON + schema como estimativa deliberadamente conservadora, adiciona 4096 de framing, reserva 32.768 de saída e exige total dentro de 80% do limite de entrada. Não é tokenização exata nem promessa de capacidade máxima. Volumes excedidos param **antes da rede**, com USER_ACTION_REQUIRED e fonte integral acessível. Sem map-reduce/hierarquia nesta V1.

Fontes atuais: [Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [Flash 3.6](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash), [Flash 3.8](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Interactions e store](https://ai.google.dev/gemini-api/docs/interactions-overview). Disponibilidade documental não comprova acesso na chave do usuário.

### Apresentação e retenção

Popup preserva captura/perfil/timer e mostra Preparando suas notas/Notas prontas; nenhum seletor de modelo ou controle de pipeline em produção. Sessão mostra notas persistidas, modelo e data, evidências com acesso por âncora à fonte, somente categorias preenchidas, copiar e Markdown nativo. Fonte permanece integral em details separado, com cópia própria. Seletor mínimo de sessões salvas conserva consulta após nova gravação; falha terminal pode ser arquivada explicitamente sem apagar dados. Retry explícito de notas também funciona em sessão salva/arquivada, com a fonte completa e o mesmo modelo. Sessões pré-Bloco 5 não são chamadas automaticamente e não são anunciadas como notas prontas.

Retenção de áudio continua dependente apenas de transcrição/cleanup, pois análise depende exclusivamente do texto. Nenhuma análise elimina transcrições. Links externos nas Configurações são navegação explícita ao AI Studio, sem carregar assets; CSP/host permissions permanecem restritos à Gemini. Texto do modelo/citações é renderizado por React como texto, sem HTML executável. Markdown escapa caracteres de conteúdo; não há PDF/DOCX ou dependências de export.

## Implementação do Bloco 4.1 — admissão e diagnóstico (17/10/2026)

`queue/transcription-rate-limit.ts` centraliza modelo e política inicial deste projeto: três reservas por janela móvel de 60s, mais 1s de segurança. Não é uma cota universal da Gemini; [os limites oficiais](https://ai.google.dev/gemini-api/docs/rate-limits) dependem de projeto/modelo e incluem RPM, TPM e RPD. A extensão não mede tráfego de outros aplicativos nem outras instalações/perfis.

IDB v3 acrescenta `transcriptionRateLimits`, um registro por modelo contendo no máximo três timestamps recentes, `blockedUntil` e último relógio observado. Sem chave, áudio, texto ou resposta bruta nesse store. Migração aditiva preserva dados v2. Reservas permanecem após falha de rede, crash ou restart; não são devolvidas porque a API pode ter recebido a chamada. Relógio retrocedendo não descarta reservas; avanço normal expira timestamps. Mudança abrupta do relógio para o futuro pode antecipar a expiração: não há relógio monotônico compartilhado que sobreviva ao restart.

`claimJob` consulta a janela sem reservar: enquanto cheia, grava `nextAttemptAt`, sem incrementar tentativas nem manter lease, e continua procurando limpeza remota. Transcrições já persistidas podem ser reconciliadas mesmo nessa situação. Imediatamente antes de `interactions.create`, `reserveTranscription` valida owner/generation/lease e reserva em uma transação de jobs + limite. Dois executores são serializados pelo IDB. Se outro executor ocupou a última vaga durante o upload, o job volta a PENDING, devolve a tentativa de claim e libera lease, conservando a identidade remota. Não se espera um minuto dentro de um job. As operações de rede continuam fora das transações.

O poll existente de 2s retoma jobs elegíveis automaticamente; produção mantém orçamento ilimitado de admissão, com até cinco tentativas reais por job. Assim, backlog de cinco partes rápidas admite até três inicialmente e as demais depois da janela, sem clique. Duração das chamadas pode naturalmente espaçá-las mais. O build de chunks curtos mantém a autorização explícita por tentativa; espera local não gasta essa autorização. Captura/rotação/persistência não aguardam a fila, e DELETE_REMOTE_FILE não usa vagas de transcrição.

429 conserva classificação RETRYABLE, jitter e budget de cinco tentativas. Em job de transcrição, agenda também cooldown compartilhado de pelo menos 61s ou `Retry-After`, o que for maior; sucessivos 429 estendem esse prazo. Isso não identifica qual cota foi atingida. `Retry-After` aceita segundos e data HTTP, sem cortar um prazo válido em 24h; ausente/inválido usa backoff + cooldown. O teste interceptando HTTP comprova que o erro de Interactions do SDK 2.24.0 expõe headers e faz uma só chamada com retries desabilitados (a classe Files ApiError tem contrato diferente). Ao esgotar tentativas, preserva material e orienta conferir cotas; não há retry infinito.

### Diarização: evidência e limite da investigação

| Camada | Evidência nesta etapa |
| --- | --- |
| Request | Adapter + SDK real com fetch interceptado serializam pt-BR, verbatim, speaker e store:false corretamente. Configuração mantida, conforme [guia oficial](https://ai.google.dev/gemini-api/docs/transcribe). |
| Response | SDK instalado normaliza steps e deriva output_text; teste com resposta sintética do contrato oficial preserva id/steps/content/annotations. A resposta bruta dos cinco chunks reais não está disponível. Não sabemos se o serviço omitiu metadata nesses retornos. |
| Parser | Caminho atual steps[].content[].annotations[] e id correspondem ao SDK e ao guia. Não há defeito demonstrado que justifique alterar caminhos ou adivinhar campos alternativos. Parser mantido. |
| Persistência | Teste passa dois speaker IDs e annotations do parser ao commit IDB e os relê sem perdas, incluindo rawText e interactionId. Isso não reconstrói metadata ausente dos cinco chunks antigos. |
| UI | Fonte integral permanece visível. Projeção por falante aparece somente com annotation word_info contendo speaker e texto; trechos sem speaker são tolerados. Identidades continuam locais por parte. |

O relato real de `annotations:[]`, `speakers:[]`, `interactionId:null` é preservado como problema aberto. Uma interjeição isolada não comprova qualidade da diarização; não atribuímos a causa a áudio, API, store:false ou SDK sem resposta real. Nenhum chunk antigo foi retranscrito e nenhuma chamada autenticada foi feita nesta etapa. Fixtures são sintéticas, explicitamente identificadas; fixture real sanitizada depende do próximo teste autorizado.

`npm run build:diagnostic` cria somente `dist-diagnostic`, modo explícito de desenvolvimento com duração normal e transcrição automática. O worker emite `MM_TRANSCRIPTION_STRUCTURE_DEV_ONLY` uma vez por resposta, antes do parser: tipos/nomes de campos limitados, contagens de steps/content/annotations/word_info e quantidade de speaker IDs, sem os valores. Não imprime texto, áudio, IDs, URI, chave, headers ou referência à resposta; não persiste diagnóstico. `dist`, `dist-chunk-test` e demais builds não incluem essa instrumentação; o auditor verifica a remoção. O teste mínimo continua sendo em dist normal. Diagnóstico adicional é opcional e separado, conforme TEST_PLAN.

## Análise crítica antes da implementação

| Premissa/problema | Avaliação e alternativa simples |
| --- | --- |
| Edge MV3 com captura em offscreen | Compatibilidade documental positiva; validar gesto, permissões e lifecycle no Edge instalado. |
| Chunks com timeslice de 29m30s | Não garante WebM independente. Rotacionar recorders completos; timeslice curto serve à persistência de fragmentos internos. |
| Margem de 30s garante limite | Timers podem atrasar. Medir duração do arquivo antes de upload e não enviar arquivo acima do limite como se válido fosse. |
| Gravação e chamadas longas no worker | Worker é efêmero. Offscreen mantém captura; processamento usa executor separado e fila durável. |
| Offscreen usa chrome.storage | Só runtime é suportado como API de extensão nesse contexto; configurações/credencial chegam por mensagem confiável do worker. IndexedDB é API web. |
| Pedir microfone invisivelmente sempre funciona | Não assumir prompt utilizável. Onboarding visível, encerrando stream de teste; novo gesto na aba correta. |
| Recomeçar gravação depois de crash | Reconciliar material salvo; MediaStreams não são persistíveis e captura precisa nova ação. |
| Áudio apagado permite retranscrição | Permite reanálise do texto, mas perde retranscrição/revisão por áudio. Explicar antes da escolha de retenção. |
| Texto de qualquer duração cabe no LLM | Captura segmentada não elimina limite de contexto. Preflight e proposta hierárquica, DEC-013. |
| Diarização resolve nomes/fala simultânea | Labels locais e atribuição incerta; não inferir identidade global. |
| Deletar Files elimina toda retenção Google | Limpeza do arquivo é uma operação específica; Interactions e termos têm políticas distintas. |

## Componentes e limites

| Componente | Responsabilidade |
| --- | --- |
| Popup React | Comandos, perfil, snapshot, timer derivado; nunca dono do stream. |
| Settings React | Chave e preferências pequenas; consentimento cloud e teste de acesso. |
| Página de sessão React | Progresso, recuperação, notas, transcrição, cópia e export. |
| Service worker | Validar comandos, reservar sessão, criar/reconciliar offscreen, obter stream ID, settings e alarms. |
| Offscreen HTML local | Capture adapter, AudioContext, recorder/rotação, escrita de fragmentos, observação das fontes. |
| Processing executor | Consumir fila sem bloquear mídia; SDK, upload/transcrição/análise/limpeza, com concorrência limitada. |
| Repository IndexedDB | Sessões, chunks, fragmentos, transcrições imutáveis, jobs, resultados e migrações. |
| Domínio compartilhado | Máquinas de estado, schemas, normalização determinística, perfis e política de retry. |

Proposta DEC-007: executor em Dedicated Worker local criado pelo offscreen, sujeito a prova de SDK e IndexedDB nesse ambiente. Offscreen permanece enquanto houver captura ou jobs ativos, por motivos reais USER_MEDIA/BLOBS; não declarar motivos fictícios. Se execução após captura não for confiável, alternativa simples é página visível de processamento com lease exclusivo e mensagem que deve permanecer aberta. Não implementar keepalive artificial do service worker. Resultado/popup não iniciam consumidores concorrentes.

```mermaid
flowchart TD
  UI[Popup / Settings / Sessão] -->|comandos e snapshots| SW[Service worker]
  SW -->|stream ID e comando| OS[Offscreen]
  TAB[Áudio da aba] --> MIX[Web Audio mixer]
  MIC[Microfone] --> MIX
  TAB --> OUT[Saída de áudio]
  MIX --> REC[Recorders rotativos]
  REC --> DB[(IndexedDB)]
  OS --> REC
  OS --> EX[Executor de processamento]
  EX <--> DB
  EX --> API[Gemini Files / Interactions]
  UI -->|leituras por adapters| DB
```

Separação futura de módulos: capture, recording, storage, queue, gemini-transport, transcription-parser, transcript-normalization, summarization, schemas, profiles e UI. Interfaces conceituais: CaptureAdapter, RecorderFactory, RecordingRepository, JobRepository, GeminiTransport, Clock e RetryPolicy. Não é scaffolding já criado.

## Compatibilidade e lifecycle Manifest V3

Microsoft lista offscreen, tabCapture e runtime para extensões Edge; isso confirma disponibilidade documental, não os detalhes de cada release. O caminho worker → stream ID → offscreen é documentado a partir do Chromium 116. Não usar novidades de Chrome 150 como pressuposto para Edge. Versão mínima exata do Edge fica aberta, baseada no teste do ambiente e detecção de capacidades. [Edge API support](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support), [guia de captura Chromium](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture).

Worker pode terminar por inatividade ou demora de evento/fetch; variáveis globais são descartáveis. Listeners devem ser registrados na inicialização. Persistir antes de confirmar comandos e reconciliar em cada ativação: ler reserva ativa, consultar contexto offscreen, perguntar sessão/streams existentes e comparar revision. Nunca reiniciar stream só porque o worker reiniciou. [Lifecycle do worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Offscreen deve ser único, HTML empacotado e comunicação por runtime. Criação concorrente precisa deduplicação e consulta via runtime.getContexts quando disponível. USER_MEDIA é o motivo da captura; AUDIO_PLAYBACK isolado tem encerramento após silêncio e não é substituto. Durante encerramento, parar tracks, desconectar nós, fechar AudioContext e só fechar offscreen após jobs/limpeza ou entrega ao executor alternativo. [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen).

Manifest efetivo do Bloco 2: storage, activeTab, tabCapture e offscreen, sem host_permissions; CSP connect-src 'none', scripts/assets locais, media-src blob: para revisão local. O offscreen só é criado no START. Alarms e host_permissions da Gemini ficam para blocos futuros. Sem content scripts, <all_urls>, permissões de vídeo ou tabs apenas para ler informações sensíveis. unlimitedStorage fica aberta mediante ensaio de quota. Microfone é permissão web de getUserMedia, não inventar permissão manifest “microphone”. Scripts/CSS locais, sem eval ou código remoto; no futuro CSP connect-src restrita ao transporte necessário e worker-src local se houver worker dedicado.

## Comandos, comunicação e início

Envelope conceitual: protocolVersion, requestId, target, type, recordingId, expectedRevision e payload validado. Comandos: START, STOP, RETRY_JOB, GET_SNAPSHOT e UPDATE_SETTINGS. Eventos: CAPTURE_STARTED, CHUNK_COMMITTED, CAPTURE_STOPPED, JOB_UPDATED e FAILURE. Não transmitir Blob por chrome.runtime: usar chave do registro IDB. Validar origem de sender e destinos internos; nada de externally_connectable. Credencial só em resposta direcionada ao contexto autorizado, nunca no snapshot público.

START reserva singleton e sessão em transação, bloqueia duplo clique e guarda perfil/settingsSnapshot. Obter microfone autorizado sem deixar token de aba esperando prompt. Criar offscreen antes de gerar ID, obter getMediaStreamId({targetTabId}), sem consumerTabId, consumir imediatamente. ID é descartável e expira em segundos. Não persistir token para recuperação. O clique na action/popup e preservação de targetTabId exigem teste; onClicked não é disparado quando action possui default_popup, então o futuro handler será a mensagem START do popup. [tabCapture API](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).

Se popup sumir durante STARTING, comando aceito segue no coordenador; se não foi aceito, reabrir mostra estado real. Falha de aquisição encerra qualquer fonte já aberta, remove reserva com revisão e mantém erro explicável. Não iniciar silenciosamente com uma só fonte.

## Mixer e captura

getUserMedia da aba usa constraints Chromium isoladas no adapter e video:false. Microfone é stream separado. Fontes ligam-se ao MediaStreamAudioDestinationNode; somente fonte da aba também liga-se ao AudioContext.destination. Conferir AudioContext.state e resume/autoplay no Edge. Nunca criar aresta microfone → saída. Usar ganhos que evitem clipping; bitrate, canalização e constraints echoCancellation/noiseSuppression/autoGainControl são escolhas abertas a ensaio, não garantias de qualidade. Headphones reduzem recaptura acústica; microfone pode captar áudio da reunião saindo pelos alto-falantes mesmo com grafo correto.

Observar ended, mute/unmute, AudioContext suspend e eventos de capture. Silêncio não é falha nem fim automático. Na perda definitiva de uma fonte, finalizar com aviso de interrupção; não continuar como se a captura completa persistisse. Duração é derivada do relógio monotônico enquanto contexto vive, com timestamps persistidos e intervalos de interrupção; relógio de parede não prova duração do áudio.

## Recorder e estratégia de chunks — proposta com gate

CHUNK_TARGET_DURATION_MS = 1_770_000; testes podem usar 10_000/20_000. OVERLAP_TARGET_MS proposto = 1_000, ainda aberto. Medir suporte com MediaRecorder.isTypeSupported('audio/webm;codecs=opus'), verificar mimeType real e enviar audio/webm ao serviço. Não trocar MIME de um formato não suportado apenas no cabeçalho.

1. Manter streams/mixer vivos durante toda sessão; não reacquirir fontes a cada chunk.
2. Recorder A produz fragmentos com timeslice curto injetável, proposta 5s. Cada fragmento é salvo em IDB por recorderId e sequence; são partes do arquivo A, não uploads independentes.
3. Começar B antes da fronteira final de A. Proposta: iniciar B a target−overlap; parar A em target, após confirmação de B e dado produzido. O timeslice normal de 5s é maior que o overlap proposto de 1s: testar emissão inicial mais curta (por exemplo 250ms) ou requestData antes da fronteira, sem assumir que o evento chega pontualmente. Se B não confirmar a tempo, registrar atraso/falha e validar duração de A; não anunciar rotação segura. Não esperar commit/upload de A para começar B.
4. Depois de dataavailable final e stop, montar Blob completo A em ordem, persistir manifest/Blob e mudar RECORDING → PENDING atomicamente. Apagar fragmentos só após commit verificável do arquivo completo; evitar duplicação permanente.
5. Medir duração do arquivo completo por técnica verificada em WebM/Edge; duration de elemento pode ser Infinity. O método de medição é gate aberto. Se exceder limite, preservar áudio e marcar erro recuperável, sem retries idênticos. Alternativa aberta: resegmentação local por decode/reencode testado, sem FFmpeg; não prometida nesta etapa.
6. STOP finaliza ambos os recorders existentes, inclusive um B muito curto, sem duplicar jobs; aguarda todos os eventos finais e commits antes de PROCESSING.

A especificação W3C garante reprodução do conjunto de blobs de uma gravação concluída, não de cada fragmento. stop/start sequencial também não tem garantia de continuidade. Sobreposição é proposta para reduzir risco de gaps, custa áudio duplicado e dois encoders brevemente; nem evento start nem primeiro blob provam ausência de lacuna. [MediaStream Recording](https://w3c.github.io/mediacapture-record/).

O alvo é duração de cada arquivo A/B, incluindo overlap, e não 29m30s acrescidos de overlap. Registrar começo/fim observados, intervalos sobrepostos e eventual overshoot. Timers do documento não são relógio de mídia exato. Suspensão/pressão de CPU podem exceder a margem; informar interrupção e impedir upload inválido.

Preservar fonte integral por chunk e demarcar overlap no consolidado. Sem timestamps de palavra, não prometer deduplicação perfeita. Uma projeção futura pode retirar duplicação textual apenas quando determinística e inequívoca no intervalo de fronteira, sempre mantendo origem/mapeamento; caso contrário conservar e sinalizar. Critérios de fronteira estão no TEST_PLAN; DEC-005 foi consolidada somente para o MVP e Edge testado.

## Persistência e contratos locais

IndexedDB da origem da extensão, transações curtas: nenhum await de rede dentro de transação. Migrações versionadas, índices por recordingId/index/status/nextAttemptAt. Confirmar transação concluída antes de anunciar áudio/transcrição salvo. Não guardar áudio em chrome.storage.local.

| Store | Campos principais |
| --- | --- |
| recordings | id, createdAt, startedAt, endedAt, profile, status, revision, sourceTabId, durationMs, chunkCount, settingsSnapshot sem chave, interruption, completeness, lastError |
| activeSession | singleton, recordingId, revision, ownerEpoch; reserva atômica de captura |
| chunks | id, recordingId, index, recorderId, approximateStartMs, approximateEndMs, measuredDurationMs nullable, overlapMs, mimeType, blob nullable, status, attempts, error, remoteFileName/uri nullable, transcriptId nullable |
| fragments | recordingId, recorderId, sequence, capturedAt, blob; chave composta única |
| transcripts | id, chunkId, rawResponse, rawText, annotations, model, apiVersion, receivedAt, parserVersion; original imutável |
| jobs | id, kind, recordingId/chunkId, status, attempts, nextAttemptAt, leaseOwner, leaseExpiresAt, generation, lastError |
| results | recordingId, schemaVersion, profile, structuredNotes, analysisModel, promptVersion, sourceRevision, createdAt |

Blob nullable representa descarte deliberado após transcrição, não áudio ausente sem explicação. Índice único (recordingId,index). jobs.kind: TRANSCRIBE, ANALYZE, DELETE_REMOTE. Falha de delete não muda chunk COMPLETED para ERROR. Estado de limpeza é separado.

Ler poucos chunks por vez; assembling do arquivo pode custar temporariamente RAM do tamanho do chunk. Proposta de bitrate a medir: 64–96 kbps, ~14–21 MB por 29m30s, sem tratar taxa solicitada como taxa garantida. Monitorar navigator.storage.estimate, falhas de quota e espaço antes/durante escrita. Não apagar pending para liberar espaço; parar com aviso e salvar o possível. Fragmentos de recorder morto são tentativa de recuperação, não WebM garantidamente decodificável. Nunca afirmar perda máxima de 5s: timeslice e commit podem atrasar.

## Máquinas de estado

Uma máquina por recording; reserva global bloqueia nova captura enquanto STARTING/RECORDING/STOPPING. Para V1 simples, bloquear também nova sessão enquanto a anterior PROCESSING ou ERROR com recuperação pendente; permitir sair de ERROR arquivando sessão interrompida explicitamente, sem apagar áudio. COMPLETED não bloqueia próxima sessão.

```mermaid
stateDiagram-v2
  [*] --> IDLE
  IDLE --> STARTING: START válido
  STARTING --> RECORDING: fontes e recorder ativos
  STARTING --> ERROR: aquisição falhou
  RECORDING --> STOPPING: STOP ou fonte encerrada
  STOPPING --> PROCESSING: fechamento e commits confirmados
  PROCESSING --> COMPLETED: todos chunks e notas válidos
  STARTING --> ERROR: contexto perdido
  RECORDING --> ERROR: crash / disco indisponível
  STOPPING --> ERROR: fechamento irrecuperável
  PROCESSING --> ERROR: trabalho esgotado / permanente
  ERROR --> PROCESSING: retry recuperável sem captura
```

COMPLETED significa processamento concluído para material declarado, não prova de captura integral: completeness = complete|interrupted permanece visível. Se último arquivo não pôde ser recuperado, registrar chunk perdido e permitir finalizar conjunto parcial só com reconhecimento explícito; análise não começa automaticamente ocultando o ausente.

Chunk: RECORDING → PENDING → UPLOADING → TRANSCRIBING → COMPLETED. UPLOADING/TRANSCRIBING → PENDING em retry temporário; qualquer fase → ERROR em falha permanente/esgotada; ERROR → PENDING após ação explícita se Blob/recurso remoto utilizável. Captura pode seguir RECORDING apesar de chunk antigo em ERROR; sessão vai ERROR quando finalizada se não puder consolidar.

Jobs usam PENDING/RUNNING/SUCCEEDED/FAILED. Retry de análise retoma PROCESSING sem retranscrever chunks completos; retry de captura requer nova sessão e gesto, nunca ERROR → RECORDING direto. STOP repetido recebe resultado idempotente, não nova finalização.

## Fila, concorrência e recuperação

Proposta: um job de rede por vez; captura nunca aguarda job. Claim de job e lease em transação IDB, generation/token impedem resposta de consumidor antigo sobrescrever commit novo. Executor renova lease; expiração permite recuperação. Esse mecanismo não garante exactly-once remoto: timeout pode duplicar upload/cobrança. Identificadores locais e nomes remotos conhecidos evitam repetição desnecessária.

Durante execução, timers curtos servem ao backoff. Worker usa chrome.alarms para acordar/reconciliar fila durável; nextAttemptAt é a autoridade, não o timer. Alarmes podem atrasar, não acordam dispositivo dormindo e sua existência deve ser reconferida ao ativar o worker. Não usar alarms para fronteira de áudio nem pressupor persistAcrossSessions no Edge. [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms).

Após crash: reconciliar captura com offscreen real; sem contexto, marcar interrupted e finalizar partes recuperáveis. Recuperar jobs RUNNING com lease expirado. Reusar remoto existente quando válido, reupload se expirou e houver Blob, preservar transcrição completa, retomar limpeza. Upload com resposta perdida pode deixar órfão sem nome conhecido; não apagar indiscriminadamente arquivos de outros aplicativos na conta.

## Gemini — contrato documental de 01/10/2026

### Transcrição

Modelo confirmado: gemini-3.5-transcribe; entrada de arquivo de áudio, limite com diarização de 30min; até oito falantes, atribuição para três ou mais experimental. Reconfirmar disponibilidade na chave do usuário. [Ficha oficial do modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe).

Contrato de request conceitual, não implementação:

```json
{
  "model": "gemini-3.5-transcribe",
  "store": false,
  "input": [{"type": "audio", "uri": "URI_DO_ARQUIVO", "mime_type": "audio/webm"}],
  "generation_config": {
    "transcription_config": {
      "language_codes": ["pt-BR"],
      "mode": {"type": "verbatim", "diarization_mode": "speaker"}
    }
  }
}
```

Usar client.interactions.create, endpoint documentado POST /v1beta/interactions. Omitir timestamp_granularities e custom_vocabulary. Extrair output_text; preservar steps[].content[].annotations[] de type word_info quando presentes. Campos text, speaker, start_offset/end_offset são opcionais conforme retorno; não solicitar timestamps de palavra para obter labels. O parser deve tolerar ausência de offsets e não inventar tempos de segmentos. Fixture real será exigida. [Guia de transcrição](https://ai.google.dev/gemini-api/docs/transcribe).

### SDK e Files

SDK browser é suportado documentalmente; isso não prova integração em worker/MV3. Importar @google/genai empacotado, instanciar com apiKey em runtime. Fixar versão que exponha Interactions e medir tamanho/compatibilidade; não copiar process.env ou paths de Node para extensão. [SDK oficial](https://github.com/googleapis/js-genai).

Files.upload aceita Blob no browser. Configuração SDK usa config.mimeType; conteúdo Interactions usa mime_type. Há discrepância com snippet de upload no guia de transcrição que usa mime_type: prevalece a assinatura da versão fixada, validada por teste. files.get({name}) consulta metadados; files.delete({name}) limpa recurso; name e uri são campos distintos. [Referência Files do SDK](https://googleapis.github.io/js-genai/release_docs/classes/files.Files.html).

Files tem limites documentados de 2GB/arquivo, 20GB/projeto e expiração de 48h, todos mutáveis. Persistir name/uri após upload; observar estado de disponibilidade antes de usar, poll limitado se PROCESSING e erro se FAILED. Delete depois do commit local da transcrição. Arquivo expirado requer Blob para reupload. [Files API](https://ai.google.dev/gemini-api/docs/files).

Interactions armazena objetos por padrão; proposta explícita store:false em transcrição e análise, sem previous_interaction_id nem background:true. Não confundir delete de arquivo com delete de interação ou garantia sobre processamento/retenção do provedor. [Interactions e retenção](https://ai.google.dev/gemini-api/docs/interactions-overview). Não foram feitas chamadas autenticadas nesta etapa; CORS, upload resumível, timeout e parâmetros reais permanecem gate do Bloco 4.

### Consolidação e análise

Ordenar por chunk.index; preservar rawText/rawResponse; produzir projeção de apresentação com chunkId, labels como “Parte 2 · Falante 1” e links para fonte. Normalização altera só apresentação/espaçamento e não corrige fala, nomes, conteúdo ou gramática. Chave de falante: (chunkId,speakerId), nunca speakerId sozinho.

Modelo confirmado para análise: gemini-3.8-flash, structured outputs suportados; ficha informa entrada 1.048.576 tokens e saída 65.536, valores mutáveis. Não enviar reunião inteira sem orçamento de tokens incluindo prompt/schema/saída. [Ficha Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).

Proposta: mesma Interactions API com response_format:{type:"text",mime_type:"application/json",schema:...}. JSON.parse seguido de Zod e regras semânticas; output_text vazio, truncado ou rejeitado é erro de análise recuperável. JSON Schema usa subconjunto suportado; validação local é mais estrita. Não misturar camelCase de generateContent com snake_case de Interactions. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output).

Contrato conceitual bem tipado, a implementar no Bloco 5:

```typescript
type Profile = 'general' | 'research' | 'development' | 'class';
type SectionKind = 'topics' | 'decisions' | 'directions' | 'pending'
  | 'importantPoints' | 'guidance' | 'methodologicalDecisions' | 'hypotheses'
  | 'experiments' | 'references' | 'openQuestions' | 'requirements'
  | 'architectureDecisions' | 'requestedChanges' | 'issues' | 'risks'
  | 'concepts' | 'definitions' | 'examples' | 'formulas' | 'emphasizedPoints'
  | 'questions' | 'assessmentTopics' | 'responsibilities';
type SourceRef = { chunkId: string; segmentId: string | null; quote: string };
type NoteItem = { text: string; evidence: SourceRef[] };
type Section = { kind: SectionKind; items: NoteItem[] };
type ActionItem = {
  task: string; owner: string | null; deadline: string | null;
  evidence: string | null; sourceRefs: SourceRef[];
};
type AnalysisResult = {
  schemaVersion: 1; profile: Profile; title: string | null;
  summary: NoteItem[]; sections: Section[]; actionItems: ActionItem[];
};
```

Campos presentes; arrays vazios representam ausência; schema da chamada restringe kind ao perfil. sections pode omitir categoria ausente ou conter items:[]; UI filtra ambas. kind único por resultado; títulos traduzidos no cliente. title:null usa fallback local de data/perfil. Aula não precisa tarefas; actionItems:[]. Owner/deadline não usam “não informado”; prazo conserva expressão explícita, sem inferir data. SourceRefs devem referenciar chunks existentes e quotes realmente presentes; isso não prova correção semântica. Não exigir segmentId se API não fornece segmentação confiável. evidence:null só aceita ausência de citação curta com sourceRefs suficientes; tarefa sem sustentação é rejeitada.

Allowlist proposta de sections por perfil (summary e actionItems ficam em campos próprios):

| Perfil | kinds permitidos |
| --- | --- |
| general | topics, decisions, directions, responsibilities, pending, importantPoints |
| research | topics, guidance, methodologicalDecisions, hypotheses, experiments, references, pending, openQuestions, importantPoints |
| development | topics, requirements, architectureDecisions, requestedChanges, issues, risks, responsibilities, pending |
| class | topics, concepts, definitions, examples, formulas, emphasizedPoints, questions, assessmentTopics |

sections:[{kind:"experiments",items:[]}] é a representação equivalente a experiments:[] no contrato compartilhado. Os quatro perfis usam a mesma validação e pipeline; allowlist, labels e instruções são configuração.

Prompt base de domínio: extrair somente informações sustentadas; não preencher categorias; não inferir tarefas, decisões, donos, prazos, experimentos, referências ou conclusões; ausência válida; listas vazias; responsável/prazo desconhecido null; hipótese não é decisão; sugestão vaga não é tarefa; labels não são nomes. Tratar transcrição como dados não confiáveis, ignorando instruções embutidas; nenhum tool/function calling, busca ou execução de links na análise.

Análise longa: preflight obrigatório; proposta hierárquica de extração por intervalos com referências e consolidação das extrações, mantendo transcrição integral. Estratégia e qualidade pendentes DEC-013; jamais truncar silenciosamente nem prometer single-call ilimitado.

## Erros e retenção

Erro de domínio: code interno, stage, recoverable, userMessage, diagnóstico sanitizado e referência de job/chunk; nunca incluir credencial/request completo.

| Falha | Política |
| --- | --- |
| Offline/timeout/5xx | PENDING, backoff com jitter, budget finito; guardar Blob. |
| 429 temporário | Respeitar Retry-After quando disponível; distinguir quota esgotada e exigir ação se persistente. |
| 401/403/chave inválida | Pausar transporte e orientar settings; sem repetição automática cega. |
| 400/formato/duração/corrupção | ERROR; explicar; não reenviar arquivo igual indefinidamente. |
| Microfone negado/aba não capturável | Falhar início, liberar fontes; orientar permissão/aba. |
| Aba fechada/fonte ended | STOPPING e resultado interrupted, salvar fechamento possível. |
| Offscreen morreu | ERROR interrupted; recuperação apenas do material disponível. |
| Worker reiniciou | Reconciliar sem parar captura viva nem criar duplicata. |
| Quota/erro IDB | Parar captura com aviso quando persistência não é segura; preservar commits anteriores. |
| Delete remoto falhou | Job DELETE_REMOTE separado; não retranscrever áudio completo. |
| Análise inválida | Preservar transcrição, tentativa limitada; UI mostra texto com erro de notas. |

Backoff proposto: base 2s, dobra até teto 30s, jitter e máximo cinco tentativas automáticas totais por etapa; números ajustáveis no ensaio. Retry explícito abre novo budget. Não prometer pontualidade durante suspensão. SDK retries devem ser contabilizados/desativados quando possível para evitar budgets multiplicados.

Retenção padrão: após resposta válida e commit atômico de transcrição/COMPLETED + registro durável de limpeza, verificar leitura antes de liberar Blob; limpeza remota tentada antes da liberação local, sem exigir sucesso de delete para considerar texto transcrito. Pending/error/corrupto preservados. Manter gravação local guarda chunks completos e permite revisão/retranscrição. Opção fixada por sessão; alteração não elimina retroativamente áudio. Falha da análise pode recuperar pelo texto mesmo se áudio já foi removido. Export não inclui chave nem áudio.

## Segurança e privacidade

Chave em chrome.storage.local, sem sync; worker aplica setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}) quando disponível e falha de restrição deve ser explícita. Não tratar TRUSTED_CONTEXTS como isolamento entre todas as páginas internas; credencial não deve chegar ao popup por snapshot. [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

Threat model pessoal aceita chave recuperável por quem controla computador/perfil. Não colocar em .env, bundle, Git, logs, exports ou erro. Texto do LLM é renderizado como texto/Markdown sanitizado, sem HTML arbitrário ou execução. Scripts e fontes locais. Futuro público requer revisão de credenciais/backend.

Aviso antes do uso: áudio e transcrição vão para Google; exclusão do arquivo não descreve toda política do serviço. Termos distinguem tratamentos conforme modalidade, região e condições; usuário deve conferir os aplicáveis à sua chave, sem promessa de “zero retenção”. [Termos oficiais](https://ai.google.dev/gemini-api/terms).

## Evidência e itens abertos

Consulta documental concluída; testes da fundação e build têm evidência em TEST_PLAN. Chamadas API, instalação no Edge, captura, desempenho e continuidade estão [NÃO VALIDADO]. Gates: gesto/permissão Edge, versão mínima, independência e duração WebM, overlap/deduplicação, executor após STOP, SDK Gemini pin, transporte real, contexto longo e quota. Fontes acima foram consultadas em 01/10/2026; revalidar antes de implementação dependente de API.

### Exceção mínima da fundação (DEC-022)

No Bloco 1 não havia gravações nem IDB de áudio. O snapshot de simulação validado, sem chave, continua em dist-dev. O worker relê o snapshot a cada comando; Promise global apenas serializa operações da instância, sem guardar estado autoritativo. O build normal do Bloco 2 usa a captura real e bloqueia comandos mock. Não há keepalive, fila ou claims de persistência durável de gravação longa.

### Histórico: implementação isolada do Bloco 2, substituída no Bloco 3

O build normal agora usa modo `capture`. O popup envia START/STOP/GET ao worker com revision e recordingId. O worker consulta a aba ativa no START, persiste targetTabId e STARTING, garante um offscreen por `runtime.getContexts` e Promise compartilhada, pede stream ID efêmero e o envia imediatamente. O offscreen detém as duas tracks, AudioContext, dois ganhos, dois AnalyserNodes, destination de mix e um MediaRecorder contínuo. A aba também conecta à saída; o microfone não. O popup lê apenas níveis numéricos aproximados enquanto está aberto; fechar o popup não afeta a captura. STOP espera `dataavailable` final e `stop`, salva um Blob de diagnóstico, para tracks, desconecta nós e fecha AudioContext. `ended` de fonte provoca finalização com estado interrompido; mute não provoca parada.

O snapshot mínimo fica em `storage.local`; GET consulta o offscreen como autoridade para captura viva. STARTING tem janela de 20 s para não ser declarado falho durante aquisição. STOPPING pode ser reconciliado com o Blob de diagnóstico se o worker reiniciar após o commit. A máquina existente ganhou `CAPTURE_COMMITTED_TEST`, que leva STOPPING diretamente a COMPLETED neste ensaio; `CAPTURE_COMMITTED` continua levando a PROCESSING para o pipeline futuro. A ação Nova gravação retorna COMPLETED/ERROR a IDLE, mantendo o arquivo de teste anterior até a próxima gravação concluída. O blob fica em um IDB temporário de uma única gravação (`meeting-memory-block2-diagnostic`), lido somente pela página local de revisão e substituído no Bloco 3. Não há chunks, fila, cloud ou transcrição. A duração curta é uma restrição operacional deste ensaio: os dados permanecem em RAM no MediaRecorder até STOP.

As permissões novas são `activeTab`, `tabCapture` e `offscreen`; não há host permissions, content script nem `<all_urls>`. CSP mantém scripts locais e `connect-src 'none'`; `media-src blob:` permite ouvir o Blob local. O build e os testes validam a estrutura, não a captura no Edge. Versão Edge observada, prompt real, MIME/bitrate reais e comportamento de autoplay permanecem sem evidência.

## Implementação local do Bloco 3 (01/10/2026)

- chunk-config.ts fixa produção em 1.770.000 ms, overlap experimental de 1.000 ms e timeslice interno de 5.000 ms. npm run build:chunk-test gera artefato separado com alvo 10.000 ms e timeslice 1.000 ms; npm run build usa produção.
- RotatingRecorder conserva fontes e mixer; inicia outro recorder no alvo menos overlap, para o anterior no alvo e salva os dois por seus próprios eventos finais. Cada WebM é montado somente com fragmentos daquele recorder. A sequência é gravada em IDB logo no dataavailable. Depois do stop, o assembly cria um Blob temporário de até uma parte e pode exigir memória adicional do tamanho dela. O usuário confirmou reprodução isolada e repetição esperada sem perda audível nas fronteiras curtas e em uma rotação real de produção no Edge testado; generalização para outras máquinas permanece aberta.
- meeting-memory IDB v1 tem recordings, activeSession, chunks, fragments e jobs. Há índice único (recordingId,index). Chunk e job local são adicionados na mesma transação; fragmentos são removidos só depois do commit. A reserva singleton usa snapshot em chrome.storage.local mais activeSession em IDB; não há transação atômica entre ambos. Reconciliar perda do offscreen exige ensaio adicional.
- PROCESS_CHUNK_TEST apenas verifica a existência local do Blob. Dedicated Worker do offscreen faz claim transacional com lease de 60s, heartbeat a cada 20s e generation; conclui chunk/job atomicamente. `RETRYABLE` respeita backoff e até cinco tentativas; `PERMANENT` fica em ERROR sem novo claim, preservando o chunk. Não há rede nem transcrição. O worker sinaliza drain ao coordenador, que muda PROCESSING para COMPLETED e fecha o offscreen. Lifecycle completo após STOP e restart real do service worker permanece não validado.
- O overlap persistido usa timestamps observados de start/stop, com cada recorder publicando seu stop antes do assembly. O chunk sucessor espera esse timestamp mesmo se sua Promise terminar primeiro; a persistência não depende da ordem dos commits. Primeiro chunk usa 0; demais usam `max(0, stopAnterior − startAtual)`. Isso altera metadata, não o WebM ou a rotação A/B.
- A duração tenta HTMLMediaElement.duration por até 3s. Infinity, NaN ou timeout resulta em measuredDurationMs = null; relógio serve como aproximação e marca overshoot acima de 30 min. Não há correção de metadata nem garantia de que o valor represente duração real do áudio. MIME, bitrate pedido/observado, fronteiras pedidas/observadas, interrupção, tamanho e overlap aproximado ficam no chunk. navigator.storage.estimate() é consultado antes do commit final; falha de escrita aciona encerramento. Sem limite rígido inventado nem exclusão automática de áudio pendente.
- Fragmentos de recorder incompleto após crash permanecem no banco e podem não constituir WebM reproduzível. Recuperação/limpeza explícita desses órfãos e medição de RAM em gravação longa continuam abertas. A página de revisão cria object URLs só para as partes da sessão e as revoga em pagehide.

Fontes da plataforma: [MediaRecorder timeslice e atrasos](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event), [duration pode ser Infinity](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/duration), [IndexedDB compartilhado entre contextos da extensão](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies), [limites do documento offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen).

## Implementação do Bloco 4 (01/10/2026)

Esta seção substitui as descrições históricas do job local acima. `@google/genai` 2.24.0, fixado no lockfile, roda apenas no Dedicated Worker empacotado. IDB v2 acrescenta somente `transcripts`; `jobs` aceita `TRANSCRIBE_CHUNK` e `DELETE_REMOTE_FILE`, além de identidade remota persistida. `commitChunk` continua atômico com o job. O service worker lê a chave de `chrome.storage.local` e a entrega por resposta runtime apenas ao offscreen identificado; ele a encaminha ao Dedicated Worker em memória. O offscreen não usa `chrome.storage`, conforme limite oficial da API. A chave não entra em IDB, transcript, erro ou bundle. Sem chave, o job aguarda credencial sem consumir tentativa. Uma mudança de chave no Settings retoma o processamento via service worker.

O adapter usa Files `upload({file: Blob, config:{mimeType,abortSignal}})`, captura `name/uri/mimeType`, grava a identidade no job sob lease e chama Interactions com `model: gemini-3.5-transcribe`, `store:false`, `language_codes:["pt-BR"]`, `mode:{type:"verbatim",diarization_mode:"speaker"}`. Não há `background`, Smart, vocabulário nem timestamps solicitados. O SDK recebe `audio/webm` como MIME aceito, enquanto o MIME original `audio/webm;codecs=opus` permanece no chunk e transcript. `output_text` é salvo sem reescrita; annotations são preservadas e a UI mostra os labels com escopo por parte. O limite pré-upload rejeita duração medida ou relógio de fronteira >=30min; quando a mídia não fornece duração, a aproximação de fronteira segura fica registrada como `durationSource: clock`.

O commit da transcrição, conclusão do job de transcrição e criação do job de limpeza usam uma transação IDB. A limpeza tenta `files.delete({name})`; 404 conta como já removido, e falhas mantêm texto válido e entram em retry próprio. A retenção é fixada no Recording ao iniciar. Áudio local com retenção padrão só é liberado após transcript e limpeza remota completos; `keep-local` preserva o Blob. A resposta de upload confirmada é persistida imediatamente. Se a geração perdeu lease entre upload e persistência, um job de limpeza de órfão é criado. A janela em que o serviço aceita upload mas a resposta se perde ainda não pode ser identificada localmente; os arquivos expiram após 48h conforme documentação oficial.

Erros de rede, abort, 429 e 5xx entram em retry limitado de cinco tentativas por job, base 2s/teto 30s com jitter; `Retry-After` é respeitado se o erro expuser headers (o `ApiError` comum do SDK 2.24.0 documenta apenas status/mensagem). Retry interno do SDK é desativado em Interactions e limitado a uma tentativa em Files para não multiplicar o orçamento da fila. 401/403 exigem correção da chave, 4xx de request são permanentes. Nenhuma mensagem bruta do SDK é mostrada ou salva. O heartbeat 60s/20s protege upload, transcrição e commit. Se houver transcript já persistido, o worker o reconcilia sem chamar Gemini novamente. A única origem de rede liberada por host permission e CSP é `https://generativelanguage.googleapis.com`; SDK e scripts são locais. No build `chunk-test`, cada clique explícito na página de sessão autoriza somente uma nova parte real; a limpeza continua mesmo após esgotar o orçamento.

Fontes oficiais verificadas: [transcrição e parser](https://ai.google.dev/gemini-api/docs/transcribe), [modelo e limite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe), [Files](https://ai.google.dev/gemini-api/docs/files), [Interactions/store](https://ai.google.dev/gemini-api/docs/interactions-overview), [SDK Files](https://googleapis.github.io/js-genai/release_docs/classes/files.Files.html). O exemplo da página Gemini mostra `config.mime_type` no upload JavaScript, mas os tipos publicados do SDK 2.24.0 exigem `config.mimeType`; o adapter segue a assinatura tipada. Essa é a divergência documental registrada antes de implementar.

Após o primeiro ensaio real, quatro partes retornaram HTTP 404. A versão inicial não preservava a etapa/código semântico do erro. A revisão classifica 404 por upload/transcrição/cleanup, guarda somente códigos seguros conhecidos, mostra quando o upload foi confirmado e não repete automaticamente. Jobs de transcrição encerrados com arquivo remoto confirmado geram cleanup durável e liberam a referência remota do job; o áudio local fica preservado. Uma repetição explícita de uma parte com 404 faz novo upload, sujeito a custo, após o usuário verificar sua chave/projeto. O teste de wire confirma que o SDK usa `/v1beta/interactions`, mas não identifica a causa do 404 da conta do usuário. [Erros oficiais](https://ai.google.dev/gemini-api/docs/api-errors).

O ensaio seguinte identificou 404 durante upload. No SDK 2.24.0, `files.upload` monta `apiVersion:''` e headers do protocolo resumível apenas quando `config.httpOptions` não é fornecido. O adapter havia definido `retryOptions` nesse campo, substituindo os defaults e formando uma URL incorreta com prefixo extra `/v1beta/`. Removemos essa opção; sem retryOptions, o SDK faz uma tentativa na iniciação. O teste de wire verifica URL `/upload/v1beta/files` e headers do protocolo. Ainda falta a chamada real para confirmar upload, transcrição e limpeza no Edge.

