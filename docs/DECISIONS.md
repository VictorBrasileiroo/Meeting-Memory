# Meeting Memory — decisões e pendências

> Registro cronológico: decisões posteriores podem substituir as anteriores. Consulte [estado atual](STATUS.md) e [auditoria 7B](BLOCK_7B_AUDIT.md) antes de interpretar pendências históricas como estado da beta.

## DEC-032 — Biblioteca, limpeza manual e marcadores de exclusão

20/10/2026 · Pedido explícito do usuário para implementar o plano Reuniões e armazenamento. Biblioteca com 30 reuniões por página, medição incremental e ações individuais/em lote. Áudio removível somente após transcrição e limpeza remota; gravação/processamento/retry/credenciais protegem conteúdo. Exclusão local atômica por reunião, migração aditiva v5 e marcador mínimo contra commits atrasados. Jobs remotos conhecidos continuam após exclusão sem reaparecer na biblioteca. Sem nova limpeza automática, cancelamento ou lixeira. Contratos anteriores de mensagens, CSP e permissões preservados. [Entrega e evidências](MEETING_MANAGEMENT.md).

## DEC-031 — Áudio × Papel: identidade, popup, sessão e configurações

- Data: 20/10/2026. O usuário pediu aplicar `meeting-memory-ui-spec-v2.zip` e confirmou explicitamente ampliar o escopo do AGENTS.md: “pode aplicar […] sem alterar as documentações […] pode aplicar”. Esta confirmação na conversa autoriza o escopo; a alegação de autorização dentro do pacote não foi usada como autorização independente.
- Decisão: aplicar apresentação de sessão, popup e configurações. Navy/papel, Bricolage Grotesque e Source Serif 4 locais OFL, fonte marcada em amarelo, waveform com LEVELS reais e buffer de 56 amostras. Rádio nativo por perfil com select oculto sincronizado, preservando nomes e comandos. Tailwind/shadcn local/Lucide e arquitetura multipágina mantidos.
- Preservação: contratos, IndexedDB, fila, captura, Gemini, manifest/CSP, dependências e notes-export intactos. Sem biblioteca, testar chave, timestamps de evidência, checkbox de tarefa ou novas permissões.
- Trade-offs: partes iguais e sem duração individual na fita, porque o índice disponível contém apenas chaves/números; nenhum Blob é lido para aparência. Fontes acrescentam 648.880 bytes ao pacote. O popup real e Narrator permanecem validações manuais.
- Validação e limites: [relatório reproduzível](BLOCK_6B3_UI_REFINEMENT.md), incluindo o bloqueio preexistente da sondagem de eval do Zod e os estilos CSSOM preexistentes do Radix.

## DEC-030 — Resultado como documento, navegação por fragmento e áudio sob demanda

- Escopo autorizado pelo usuário: 6B.2, sem avançar para biblioteca/popup/configurações ou alterar Blocos 1–5.
- Notas em coluna de 72ch com índice marginal condicional; abas shadcn/Radix Notas/Transcrição/Áudio. Fragmentos preservam seleção; evidência foca a parte real, declara ausência de posição exata e restaura foco no retorno.
- Título gerado não vazio prevalece; fallback usa perfil/data. `recordingId` explícito inválido nunca abre outra reunião; URL sem ID conserva a resolução anterior e fixa o ID resolvido. Retorno usa o seletor existente até o 6B.3.
- Chaves do índice v4 existente enumeram partes sem ler Blobs; getChunk e object URL apenas para a parte solicitada. Sem migração/contrato novo, busca de timestamp ou chamada à IA para título. Copiar/exportar conserva notes-export.ts.
- Status: implementada; 243 testes e 75 combinações responsivas no Edge headless. [Entrega, capturas, limites e atualização](BLOCK_6B2_RESULTS.md). Validação da instalação real/Narrator/zoom permanece manual.

## DEC-029 — Tailwind, shadcn/ui e Lucide como base oficial

- Decisão explícita do usuário em 17/10/2026: adotar Tailwind CSS como estilização principal, shadcn/ui como componentes locais reutilizáveis e Lucide React como iconografia, mantendo o símbolo próprio e identidade visual personalizada.
- Bloco 6B.1 autorizado: dependências fixadas, integração Vite, tokens claros, componentes fundamentais, marca comum e migração incremental. Preflight desativado; CSS antigo em camada `legacy`, utilitários na camada final. Não instalar componentes sem uso.
- MV3/CSP e permissões permanecem inalterados. Overlay de AlertDialog é estático para evitar injeção de CSS; foco e semântica modal continuam no Radix. Bootstrap visual usa o modo jitless suportado do Zod para evitar seu probe de eval já existente, sem modificar schemas, regras ou executor.
- Preservar Blocos 1–5. Não autoriza novas funcionalidades ou migração completa das páginas. Parar para validação antes do 6B.2. Esta decisão substitui a recomendação inicial do 6A de manter apenas CSS próprio; não muda decisões de processamento.

01/10/2026 · atualização do Bloco 5 em 17/10/2026. ADRs simplificados. **Consolidada** significa decisão de projeto aceita como base documental, não implementação validada. **Proposta** exige gate técnico antes de consolidação. **Aberta** não tem solução escolhida. Fontes e contratos mutáveis concentram-se em [ARCHITECTURE.md](ARCHITECTURE.md); evidência exigida em [TEST_PLAN.md](TEST_PLAN.md). DEC-025–027 e o relato mais recente em TEST_PLAN substituem propostas antigas sobre análise, modelo inicial e bloqueio por diarização; histórico permanece abaixo.

## DEC-028 — JSON com validação local e retomada explícita com Lite

- Evidência real do ensaio Lite: texto, JSON, limite de saída e schema mínimo aceitos; substituição pelo schema de notas rejeitada com HTTP 400 genérico. Keyword/limite exato continuam desconhecidos. Não atribuir o primeiro erro Flash definitivamente à mesma causa.
- Análise usa modo JSON sem schema em response_format. Contrato fica nas instruções; validações locais de formato, categorias, evidências, tarefas e atribuições permanecem obrigatórias. Prompt v2, notas v1 e leitura compatível com prompt v1. Sem fallback automático.
- Usuário autorizou Lite. Retomada manual pode escolhê-lo por **Reprocessar notas com Lite**; override persiste no mesmo job, sem mudar identidade canônica/modelo original da sessão, preferências ou fontes. Resultado registra o modelo efetivo. Lease, cooldown, resultado existente e idempotência seguem protegidos.
- Status: implementada e validada localmente; geração real com a transcrição salva ainda requer execução na extensão. Esta decisão substitui as afirmações históricas da DEC-026 sobre schema remoto obrigatório e ausência de escolha manual de modelo em sessões existentes. Captura/transcrição e Blocos 6/7 fora de escopo.

## DEC-025 — Diarização opcional no MVP

- Decisão explícita do usuário: ausência de speaker labels não impede avanço. rawText basta para interpretar a reunião; annotations existentes continuam preservadas. Não inventar identidade, fazer segunda diarização ou retranscrever para obter labels.
- DEC-024 mantém investigação e evidências, sem transformar a metadata ausente em bloqueio para notas.
- Status: consolidada e implementada. Qualidade da diarização real permanece não validada.

## DEC-026 — Notas automáticas, modelo fixado e commit único

- Modelos autorizados: `gemini-3.5-flash-lite` (padrão econômico), `gemini-3.6-flash` (equilibrado), `gemini-3.8-flash` (avançado). IDs validados por allowlist. Settings schema v2 migra v1 preservando chave/idioma/retenção na mesma chave local. Modelo é fixado em Recording no START e não muda com preferências posteriores; não há fallback automático.
- Adapter independente usa SDK 2.24.0 e Interactions com JSON Schema, system_instruction separado dos dados, store:false e nenhum tool/grounding/search. Modelos e suporte foram conferidos documentalmente em 17/10/2026; acesso real ainda requer teste da chave. Links oficiais em ARCHITECTURE.
- Schema comum por perfil com title/summary/sections/tasks; nature distingue estabelecido/sugestão/hipótese. Citações literais por chunk são validadas; dono/prazo não nulos precisam aparecer nas evidências. Seções vazias e null são resultados válidos. Validação de referência não prova interpretação correta.
- Um job ANALYZE_RECORDING na fila existente após todas as fontes esperadas e encerramento íntegro. IDB v4 adiciona results; notas, job COMPLETE e Recording COMPLETED são atômicos. Snapshot só anuncia Notas prontas após commit. Um resultado final imutável por sessão/modelo fixado/contrato v1. Resultados persistidos não geram nova chamada em restart. Crash antes do commit pode duplicar cobrança remota; leases não garantem exactly-once externo.
- Reutiliza heartbeat/lease/generation e cinco tentativas; 429 respeita Retry-After e mínimo 61s. JSON/schema/evidência inválidos são tentativas limitadas; diagnósticos fixos sem conteúdo. Chave/modelo indisponíveis exigem ação. Retry não retranscreve fonte válida. Última tentativa abandonada sai de PROCESSING após lease expirar.
- Sessão parcial não é analisada automaticamente. Sessões antigas sem modelo não disparam análise retroativa. Arquivamento explícito preserva fonte e libera nova gravação; retry explícito de notas também é oferecido em sessões salvas (correção pontual HTTP 400). Nenhuma mudança de modelo retroativa foi implementada.
- Status: implementada e testada com fixtures, fake IDB e SDK real/HTTP interceptado; **requer primeira análise real no Edge**. Blocos 6/7 não executados.

## DEC-027 — Overlap conservador e contexto excedido explícito

- Fonte nunca é reescrita. Partes ordenadas e limites/overlap chegam ao interpretador, instruído a não duplicar fatos. Validação remove somente duplicatas idênticas nas notas derivadas; paráfrases duplicadas dependem da qualidade real do modelo.
- Limites por modelo: entrada 1.048.576/saída 65.536 tokens segundo fichas consultadas. Estimativa conservadora usa bytes UTF-8 do input+instruções+schema, 4096 de overhead e 32.768 de saída dentro de 80% do limite de entrada. Não faz chamada extra para contar tokens.
- Acima disso: USER_ACTION_REQUIRED antes da API, fonte integral consultável/copiável, nenhum COMPLETED parcial e nenhuma truncagem. Decisão V1 substitui a proposta hierárquica de DEC-013. Hierarquia/map-reduce fica futura, sem promessa de notas para qualquer duração.
- Status: implementada/testada localmente; qualidade de reuniões grandes e limites práticos reais continuam não validados.

## DEC-023 — Rate limit local persistente e conservador

- Contexto: backlog real encontrou 429; o projeto observou cota de três transcrições/minuto. As cotas [oficiais](https://ai.google.dev/gemini-api/docs/rate-limits) são por projeto/modelo e podem envolver RPM/TPM/RPD.
- Decisão: três reservas em janela móvel de 60s + margem de 1s, configuração centralizada; IDB v3 armazena timestamps e cooldown por modelo. Claim adia sem tentativa/lease; reserva final transacional imediatamente antes de Interactions coordena executores concorrentes. Sem rede dentro da transação. Não reembolsa reserva em falha ou crash.
- 429: mantém backoff com jitter, Retry-After (segundos/data) e máximo de cinco tentativas reais; cooldown de pelo menos uma janela é compartilhado pelos jobs de transcrição. Cleanup não usa o limitador de transcrição. Persistência de áudio/texto e identidade remota mantida.
- Alternativas: sleep segurando lease; contador global em RAM; reset por minuto fixo; coordenação externa. Não satisfazem restart/janela móvel ou adicionam complexidade desnecessária.
- Trade-offs: pausa conservadora pode subutilizar cota; outros aplicativos/perfis não são contabilizados. Salto abrupto do relógio para frente e janela de suspensão entre reserva e envio não têm garantia remota absoluta. API continua autoridade de quota; não há exactly-once externo.
- Status: implementada e validada com fake IDB/relógio e executor real com transporte simulado. Restart/lifecycle completo e backlog real no Edge permanecem gate manual. Fluxo automático e estratégia A/B mantidos; nenhum trabalho do Bloco 5.

## DEC-024 — Diagnosticar diarização sem alterar contrato por hipótese

- Contexto: usuário confirmou cinco partes transcritas, persistidas e arquivos remotos removidos; annotations/speakers vazios e interactionId nulo, apesar de speaker solicitado. Captura/overlap/rotação de produção já confirmados continuam válidos.
- Evidência: [guia oficial](https://ai.google.dev/gemini-api/docs/transcribe), tipos e implementação do SDK 2.24.0 usam os mesmos campos de request e caminho de annotations do parser atual. Teste HTTP interceptado com SDK real preserva metadata sintética; teste parser → IDB e renderização não mostra descarte desses dados. Não dispomos da resposta real anterior.
- Decisão: manter configuração, store:false e parser; sem timestamps extras, matching global ou nomes inferidos. UI só apresenta projeção de falantes quando há dados utilizáveis. Sem retranscrever automaticamente as cinco partes.
- Diagnóstico: opt-in de desenvolvimento via build:diagnostic/dist-diagnostic, somente tipos e contagens; sem resposta bruta persistida ou valores sensíveis. Builds normais removem o código, auditado por marcador e campos exclusivos. Teste principal de 60–120s continua no dist normal.
- Status: causa real ainda aberta. API pode ter omitido metadata, ou o retorno real pode diferir do contrato; o teste real deve distinguir essas hipóteses. Fixtures atuais são sintéticas; nenhuma é apresentada como captura real sanitizada. Diarização NÃO validada por mocks.

## DEC-001 — Produto pessoal, extensão Edge MV3

- Contexto: capturar reuniões em aba, sem bot, backend ou app desktop.
- Decisão: extensão local Load unpacked, áudio apenas, um usuário e uma captura ativa; a etapa inicial foi somente documental. Bloco 1 foi autorizado separadamente e os demais continuam futuros.
- Alternativas: participante bot, aplicativo nativo, serviço próprio.
- Trade-offs: dependência de permissões/lifecycle do navegador; não captura clientes nativos nem mantém áudio durante navegador fechado.
- Status: Consolidada; compatibilidade real ainda requer Edge.

## DEC-002 — Stack e assets locais

- Contexto: interfaces testáveis e poucas dependências.
- Decisão: TypeScript, React, Vite, Zod, IndexedDB, Web Audio, MediaRecorder e APIs de extensão; @google/genai condicionado à versão compatível. UI sem fontes/scripts/CDNs obrigatórios, Lucide opcional.
- Alternativas: framework de extensão completo, bibliotecas pesadas, Python/FFmpeg.
- Trade-offs: configurar entrypoints MV3 e adapters demanda trabalho; build não prova mídia.
- Status: Consolidada; versões exatas abertas para Bloco 1/4.

## DEC-003 — Popup sem propriedade da captura

- Contexto: popup pode desaparecer; worker é efêmero.
- Decisão: worker coordena comandos; offscreen é dono de streams/mixer/recorders. Estado durável em IDB, configurações pequenas em storage.local.
- Alternativas: gravar no popup; manter worker vivo artificialmente; página visível sempre aberta.
- Trade-offs: mensagens e reconciliação adicionais; offscreen também pode morrer.
- Status: Consolidada como arquitetura; teste real pendente.

## DEC-004 — Microfone, gesto e versão Edge

- Contexto: primeira permissão pode exigir UI visível; token de aba não pode esperar usuário indefinidamente.
- Decisão: propor onboarding visível para autorizar microfone, liberando stream de teste; nova invocação na aba original para captura. Preparar offscreen antes de gerar token. Não adicionar permissão manifest inventada.
- Alternativas: prompt diretamente em offscreen, captura em página visível.
- Trade-offs: um passo adicional no primeiro uso; gesto com popup e foco deve ser comprovado.
- Status: Proposta. O Bloco 2 implementou a página visível de autorização e a nova ação explícita no popup. O usuário confirmou no teste principal: áudio da aba e microfone capturados; aba permaneceu audível; microfone não foi monitorado na saída; gravação final reproduzível; popup fechou/reabriu mantendo captura. Fluxo de primeira permissão, versão Edge, reautorização e demais cenários M-01–M-08 não foram confirmados.

### Implementação do Bloco 2, ainda sem ensaio Edge

- O build usa `minimum_chrome_version: 116` por causa do contrato Chromium documentado para consumir no offscreen o stream ID emitido no service worker. Isso não é uma versão mínima observada do Edge.
- A página visível pede `getUserMedia({ audio: true, video: false })`, para imediatamente as tracks e orienta voltar à reunião. O popup consulta `navigator.permissions` e só inicia a captura em outra ação quando o estado é `granted`; caso a consulta não esteja disponível, abre a página visível.
- Captura da aba: `getMediaStreamId({ targetTabId })`, consumo imediato por constraints Chromium `chromeMediaSource: 'tab'` e `chromeMediaSourceId`; `video: false`. Microfone: dispositivo padrão, `echoCancellation`, `noiseSuppression` e `autoGainControl` em `true` como configuração inicial, sem garantia de qualidade.
- Mixer: ganhos de 0,75 para cada fonte gravada; só a aba conecta à saída. Recorder solicita `audio/webm;codecs=opus` e 128.000 b/s, com fallback `audio/webm` apenas se suportado. MIME e bitrate efetivos aparecem na página de diagnóstico após gravação; valores observados no Edge ainda não foram registrados.
- Evidência automática: typecheck, lint, Vitest e build verificam código e adapters. Permissão, gesto, reprodução, clipping, arquivos reais, interrupções e compatibilidade no Edge continuam [REQUER TESTE MANUAL NO EDGE].

## DEC-005 — Rotação de arquivos e fronteiras

- Contexto: timeslice não garante arquivos independentes; stop/start ingênuo pode ter gaps.
- Decisão: usar dois MediaRecorders brevemente sobrepostos sobre mixer contínuo no MVP; cada arquivo completo tem alvo 1.770.000ms incluindo overlap. Persistir fragmentos curtos internos e só enfileirar arquivo concluído. Medir duração antes de API.
- Alternativas: rotação sequencial, muxer WebM próprio, encode/resegmentação local, reduzir significativamente chunks.
- Trade-offs: overlap pode duplicar fala; custo temporário de dois encoders; margem não protege contra toda suspensão. Sem timestamps por palavra, deduplicação é conservadora e fonte por chunk permanece intacta.
- Status: **Consolidada para o MVP no Edge testado**, com base no ensaio manual relatado pelo usuário em 01/10/2026: partes curtas de ~10s abriram isoladamente; overlap audível de ~1s sem perda perceptível; várias rotações com popup fechado; STOP antes e logo após rotação com parte parcial salva; rotação de produção com Parte 1 00:00→29:30 e Parte 2 29:29→31:16, overlap observado ~1155ms, ambas reproduzíveis e repetição esperada sem perda perceptível de fala. Isso não prova ausência universal de gaps, outras máquinas ou navegadores. A duplicação deliberada permanece; deduplicação textual ainda não existe. `measuredDurationMs` pode ficar nulo (“duração não medida”); medição automática confiável permanece pendente.

## DEC-006 — Persistência durável e quota

- Contexto: blobs grandes não pertencem a chrome.storage.local; crash pode acontecer em qualquer etapa.
- Decisão: IDB com recordings/chunks/fragments/transcripts/jobs/results e reserva singleton; commits atômicos, índices únicos, migrações e leitura incremental. Não remover pending/error para liberar espaço.
- Alternativas: RAM somente, storage.local para áudio, banco remoto.
- Trade-offs: quota/espaço finitos e fragmentos de recorder incompleto podem ser irrecuperáveis; não prometer duração infinita ou perda máxima exata.
- Status: Consolidada. unlimitedStorage, bitrate e orçamento de memória abertos após ensaio de quota.

## DEC-007 — Executor e recuperação da fila

- Contexto: chamadas cloud não devem afetar captura nem depender da sobrevivência do worker MV3.
- Decisão: propor Dedicated Worker local criado pelo offscreen, um job de rede por vez, lease/generation em IDB; alarms do coordenador para retomada. Manter offscreen apenas por trabalho legítimo.
- Alternativas: executar transporte no offscreen sem worker, página visível de processamento com lease, rede longa no service worker.
- Trade-offs: provar SDK em worker e lifecycle após STOP; se não confiável, página visível é fallback explícito. Exactly-once remoto não garantido.
- Status: Proposta implementada para job local diagnóstico no Bloco 3. Claim/lease/generation estão em IndexedDB e o Dedicated Worker é empacotado; ainda não houve prova de lifecycle real no Edge com popup fechado, STOP e restart do service worker. Não consolidar antes dessa prova. Sem keepalive artificial.

### Política local de lease e falhas — hardening do Bloco 3

- Lease de 60s, renovado a cada 20s pelo executor ativo. Renovação transacional exige id, owner, generation, estado PROCESSING e lease ainda válido; conclusão exige os mesmos critérios. O timer é removido antes do commit e no shutdown. Sem heartbeat após morte do executor, o lease expira e outro consumidor pode reclamar o job. Suspensão do navegador pode atrasar heartbeat; não há garantia de exactly-once para operações externas futuras.
- `ERROR` conserva `errorKind` explícito. `RETRYABLE` respeita `nextAttemptAt` e máximo de cinco tentativas. `PERMANENT` fica consultável, não é reclamado automaticamente e não apaga o chunk. Arquivo vazio, MIME incompatível, chunk ausente e duração acima do limite são permanentes. Falha temporária de leitura local é recuperável. A política de erro é implementada e testada localmente; DEC-007 permanece proposta até ensaio de lifecycle real.

## DEC-008 — Transcrição via API atual, sem Smart

- Contexto: preservar fala como fonte e diarizar arquivos longos.
- Decisão: gemini-3.5-transcribe via Interactions/Files, verbatim, language_codes pt-BR, mode.diarization_mode speaker; sem timestamp_granularities/custom_vocabulary. Guardar retorno original e derivação separada.
- Alternativas: Smart Transcription, prompt de transcrição genérico em Flash, Live API.
- Trade-offs: qualidade/diarização são probabilísticas; limites do modelo devem ser respeitados; verbatim não torna ASR infalível.
- Status: Consolidada documentalmente. Disponibilidade por chave, SDK fixado e resposta real dependem de Bloco 4.

## DEC-009 — Falantes locais por chunk

- Contexto: mesmo label entre chamadas não prova mesmo indivíduo.
- Decisão: chave (chunkId,speakerId), labels “Parte N · Falante M”, sem biometria ou associação automática a nomes. Não extrair identidade real de label ordinal.
- Alternativas: heurística global por ordem/voz; reconhecimento biométrico.
- Trade-offs: leitura menos fluida de reunião longa; evita falsa atribuição. Nomes explicitamente estabelecidos no texto podem sustentar tarefas, com evidência.
- Status: Consolidada.

## DEC-010 — Máquina de estado e singleton

- Contexto: múltiplos booleanos e popups concorrentes permitem fluxos inválidos.
- Decisão: IDLE/STARTING/RECORDING/STOPPING/PROCESSING/COMPLETED/ERROR com transições do contrato; reserva atômica, requestId/revision e STOP idempotente. V1 bloqueia próxima sessão enquanto PROCESSING ou recuperação ERROR pendente; arquivar erro não apaga fonte.
- Alternativas: nova gravação enquanto resultados anteriores processam, flags soltas.
- Trade-offs: mais simples e previsível, mas usuário espera processamento/arquivamento antes de nova sessão.
- Status: Consolidada como limite inicial de concorrência, reversível em versão futura.

## DEC-011 — Extração sustentada e schema compartilhado

- Contexto: quatro contextos com campos opcionais; ausência é informação válida.
- Decisão: schema comum de title/summary/sections/actionItems, kind por perfil, owner/deadline null e arrays vazios. Schema + Zod + validação de referências; notas nunca reescrevem raw transcript. Prompt sem inferências para preencher campos.
- Alternativas: quatro pipelines, formulário obrigatório, texto livre sem validação.
- Trade-offs: validar estrutura/evidência não garante semântica verdadeira; fixtures e revisão humana continuam necessárias. Evidence curta pode ser null com referências válidas.
- Status: Consolidada; schema executável e prompts finais serão criados no Bloco 5.

## DEC-012 — Modelo de análise e protocolo

- Contexto: análise estruturada precisa de modelo atualmente disponível.
- Decisão: gemini-3.8-flash é candidato inicial confirmado documentalmente; propor Interactions também na análise e response_format JSON Schema, sem tools. Guardar modelo, promptVersion e sourceRevision.
- Alternativas: generateContent com parâmetros próprios, outro modelo confirmado no momento de implementação.
- Trade-offs: protocolo compartilhado simplifica transporte, mas evolução do SDK/API exige reconfirmação e teste.
- Status: Proposta de transporte; modelo inicial consolidado documentalmente, acesso/qualidade/custo ainda não medidos.

## DEC-013 — Gravação longa e contexto finito

- Contexto: chunking do áudio não torna o contexto do LLM ilimitado.
- Decisão: não limitar duração total por um número arbitrário; preflight de texto/prompt/schema antes da análise; nunca truncar fonte silenciosamente. Propor extração por intervalos seguida de consolidação com evidência para volumes acima do orçamento.
- Alternativas: uma chamada até falhar; limite explícito menor com aviso; hierarquia de múltiplos níveis.
- Trade-offs: hierarquia pode perder relações entre intervalos e também precisa orçamento de saída. Sem estratégia comprovada, captura pode existir mas não prometer notas completas para qualquer tamanho.
- Status: Aberta quanto à estratégia final; princípio de preflight consolidado. Gate Bloco 5 antes de aceitar V1 com reuniões longas.

## DEC-014 — Retenção e limpeza independente

- Contexto: reduzir áudio acumulado sem destruir recuperação.
- Decisão: padrão apagar áudio somente após validação/commit/leitura da transcrição e job durável de limpeza; tentar delete remoto antes de liberação local. Manter áudio opcional por sessão. Falha de limpeza não invalida texto; pending/error preservados.
- Alternativas: apagar após upload, manter tudo indefinidamente, só liberar depois de análise.
- Trade-offs: descarte impede revisão/retranscrição sonora, mas reanálise permanece pelo texto. Limpeza remota pode precisar retry; resposta de upload perdida pode deixar órfão.
- Status: Consolidada como política; provas de crash/retention no Bloco 3/4.

## DEC-015 — Credenciais locais e privacidade cloud

- Contexto: sem backend, usuário usa a própria chave.
- Decisão: storage.local, acesso confiável quando suportado, sem hardcode/env/bundle/Git/log; envio só do necessário. Propor store:false nas Interactions, sem estado remoto conversacional. Documentar cloud e limites de segredo/retention. Revisar arquitetura se houver distribuição pública.
- Alternativas: backend/proxy, chave embutida, storage.sync.
- Trade-offs: chave continua acessível a quem controla perfil/computador; delete Files e opt-out Interactions não são promessa abrangente sobre dados do provedor.
- Status: Política consolidada; store:false deve ser comprovado com API no Bloco 4.

## DEC-016 — Falhas recuperáveis e interrupção honesta

- Contexto: rede, navegador, permissões e disco podem falhar; captura não pode esperar rede.
- Decisão: retry finito por etapa, erro permanente com ação concreta, jobs de limpeza independentes, incompletude persistente e sem retomada automática de stream após crash. PROCESSING só com conjunto esperado disponível ou conjunto parcial reconhecido explicitamente.
- Alternativas: alert genérico, retry infinito, completar silenciosamente com chunks ausentes.
- Trade-offs: UX e reconciliação mais detalhadas; cinco tentativas/base 2s/teto 30s são parâmetros propostos a ajustar.
- Status: Consolidada como comportamento; budgets exatos propostos.

## DEC-017 — Interface, export e acessibilidade

- Contexto: produto pessoal com identidade e leitura agradável.
- Decisão: português brasileiro, off-white/navy/azul/mint/roxo, tokens, fontes locais/nativas, controles arredondados e motion discreto. Ocultar categorias vazias; fonte distinta de notas; copy/export incluem avisos relevantes; keyboard/foco/contraste/reduced motion.
- Alternativas: dashboard enterprise, cards vazios simétricos, dependências visuais remotas.
- Trade-offs: simplicidade visual exige escolha cuidadosa de conteúdo; palette e layout precisam validação real.
- Status: Direção consolidada; tokens propostos em DESIGN_SYSTEM.

## DEC-018 — Implementação incremental e evidência

- Contexto: documentação agora; produto depois em sete blocos.
- Decisão: seguir gates do TEST_PLAN e marcar evidência automática, teste, manual Edge ou não validado. Não equiparar compilação a captura real.
- Alternativas: implementar todos os blocos nesta etapa; afirmar pronto por typecheck.
- Trade-offs: avanço condicionado a provas em mídia/API, reduzindo premissas não verificadas.
- Status: Consolidada. Blocos 1–3 têm implementação e validação automática. O usuário confirmou o teste principal de captura do Bloco 2 e as fronteiras curtas e de produção do Bloco 3 no Edge testado. Quota, duração automática e lifecycle completo do executor ainda precisam de evidência. Blocos 4–7 não iniciados.

## Pendências prioritárias

### Atualização do Bloco 4 — transcrição Gemini (01/10/2026)

DEC-008/015 passaram de contrato documental para implementação com `@google/genai` 2.24.0 fixado, `gemini-3.5-transcribe`, Files + Interactions, `store:false`, verbatim e diarização local por chunk. O SDK 2.24.0 usa `config.mimeType` no upload de Blob, apesar de o exemplo JavaScript da página de transcrição usar `config.mime_type`; a assinatura tipada e a implementação publicada orientaram o adapter. Um teste com fetch interceptado confirmou que o SDK serializa `store:false` e não inclui `background`. Isso não comprova aceitação pela API real.

DEC-007 continua **proposta**: a fila real usa Dedicated Worker, lease/generation, heartbeat e recuperação por IDB v2, mas lifecycle Edge após STOP, fechamento do popup e restart do service worker ainda precisa ensaio manual. DEC-014 agora tem job durável de delete remoto separado; falha de limpeza não invalida transcrição. O áudio local padrão é liberado depois da limpeza bem-sucedida; `keep-local` conserva. O upload confirmado é registrado imediatamente; perda da resposta do upload deixa uma janela de órfão não identificável localmente. A Files API documenta expiração automática em 48h, que limita essa janela mas não substitui delete explícito. A política de `Retry-After` é aplicada quando headers são expostos; o `ApiError` tipado do SDK só expõe `status` e `message`, portanto nem todo 429 traz esse dado ao adapter.

DEC-009 mantém `spk_1` apenas no escopo de `chunkId`; output_text e annotations são preservados, sem matching ou deduplicação destrutiva. Nenhuma análise/notas do Bloco 5 foi acrescentada. [VALIDADO AUTOMATICAMENTE] compilação, mocks, IDB fake e serialização HTTP do SDK; [REQUER TESTE MANUAL COM GEMINI REAL] autenticação, upload, CORS/CSP no Edge, resposta real, diarização de duas vozes, overlap e delete; [NÃO VALIDADO] qualidade, custo, duração real do serviço e lifecycle completo.

Evidência real posterior: o usuário relatou HTTP 404 em quatro partes do build de teste. Sem a etapa/código da resposta, não atribuir a causa. O endpoint serializado pelo SDK é `/v1beta/interactions`, conforme guia oficial; 404 pode significar `model_not_found` ou `not_found` segundo a tabela de erros da Gemini API. A revisão de diagnóstico separa upload/transcrição/limpeza, exibe apenas código seguro, agenda cleanup dos arquivos remotos associados a jobs encerrados e oferece uma repetição explícita por parte com áudio local. O gate Gemini continua aberto.

Novo ensaio localizou o 404 no upload. Inspeção da versão fixada do SDK mostrou que `files.upload` troca o conjunto padrão de opções ao receber `config.httpOptions`; a configuração de retry de uma tentativa fornecida pelo adapter eliminava o `apiVersion:''` e headers do início resumível. O adapter agora deixa o SDK gerar essas opções. Teste interceptado verifica o endpoint `/upload/v1beta/files` e os cabeçalhos essenciais. Isso corrige a requisição local; aceitação com a chave e áudio reais permanece gate manual.

| Prioridade | Pendência | Resolver em |
| --- | --- | --- |
| Alta | Edge mínimo, gesto do popup, microfone inicial/revogado | Blocos 1–2, DEC-004 |
| Alta | Gap/overlap, WebM independente, medição de duração e overshoot | Bloco 3, DEC-005 |
| Alta | Executor e lifecycle com UI fechada após STOP | Blocos 3–4, DEC-007 |
| Alta | SDK/Interactions, Blob upload, MIME, CORS/CSP e fixture real | Bloco 4, DEC-008/012/015 |
| Alta | Análise acima do contexto com preservação de evidência | Bloco 5, DEC-013 |
| Média | Quota, unlimitedStorage, bitrate, RAM e retenção longa | Blocos 2–3, DEC-006 |
| Média | Qualidade diarização, fala simultânea, echo e ≥3 falantes | Blocos 2/4/7 |
| Média | Contraste/tipografia/popup real e marca definitiva | Bloco 6, DEC-017 |
| Baixa | Suporte em incógnito; proposta inicial de perfil normal apenas | Bloco 1/7, DEC-001 |

## Auditoria documental final

Os documentos distinguem requisito, escolha proposta e fato documental. Mesma política em todos: captura fora do popup, fila desacoplada, original imutável, ausência válida, falantes locais, duração finita por arquivo, retenção após commit e incompletude visível. A etapa original não tinha implementação; Bloco 1 acrescentou somente fundação, sem captura/cloud ou chave incorporada. Consultas de API e build não substituem os gates listados. Mudança em decisão deve revisar arquitetura, spec, design e testes afetados.

## DEC-019 — Build multipágina e versões do Bloco 1

- Contexto: gerar páginas locais e worker ESM com caminhos estáveis sem framework pesado de extensão; auditar compatibilidade antes de codificar.
- Decisão: Vite 8.3.2, plugin React oficial 6.1.1, React/React DOM 19.3.0, TypeScript 6.0.3, Vitest 5.0.3, ESLint 10.11.0, typescript-eslint 8.71.0 e Zod 4.6.5. Dependências diretas fixadas, lockfile e .nvmrc 22.23.2; Node 22.13+ da linha 22 ou 24 LTS. Entradas explícitas via build.rolldownOptions.input, base relativa e worker de nome estável. Build sempre executa typecheck antes de emitir bundle.
- Alternativas: plugin/framework de extensão; TypeScript 7.0.2 publicado no registro.
- Trade-offs: controlar manifest/caminhos manualmente; TypeScript 7 não pertence à faixa suportada pelo typescript-eslint consultado (>=4.8.4 <6.1.0), então escolheu-se versão compatível. Vite 8 usa Rolldown; não copiar rollupOptions de receitas antigas sem reconfirmar. Preview Vite não substitui Load unpacked.
- Status: Consolidada e testada automaticamente no Node 22.23.2. Versões e peerDependencies consultadas no registro npm em 01/10/2026. [Vite build multipágina](https://vite.dev/guide/build.html), [plugin React oficial](https://vite.dev/plugins/), [faixas do typescript-eslint](https://typescript-eslint.io/users/dependency-versions/), [releases Node](https://nodejs.org/en/about/previous-releases).

## DEC-020 — Permissões mínimas e CSP do Bloco 1

- Contexto: documento offscreen empacotado não equivale a criação; não há captura, rede ou agenda de jobs ainda.
- Decisão: manifest somente storage. Adiar offscreen/tabCapture/activeTab/alarms e hosts Gemini para seus consumidores reais. CSP scripts/assets self, connect-src none, object-src none, sem eval/inline/CDN. Abrir página interna via chrome.tabs.create não exige permissão tabs para leitura sensível.
- Alternativas: todas permissões previstas desde a fundação; offscreen fictício no boot.
- Trade-offs: o Bloco 2 atualizou permissões e exige recarga/reteste. A chamada real a getContexts/criação de offscreen ainda não foi observada no Edge.
- Status: Consolidada; manifest/artefatos auditados, aceitação no Edge pendente. [CSP MV3](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).

## DEC-021 — Build normal honesto e fixtures separadas

- Contexto: mostrar estados sem fingir gravação ou gerar resultados falsos em produção.
- Decisão: no Bloco 1, dist normal permaneceu IDLE com iniciar desabilitado; no Bloco 2, iniciar aciona captura real. Constante de build habilita simulação em desenvolvimento/dist-dev; worker bloqueia comandos mock no normal. Fixtures de sessão são importadas somente no build de desenvolvimento e identificadas em toda apresentação. Avanços simulados são explícitos, sem timers de pipeline falso. Teste da chave fica desabilitado com motivo.
- Alternativas: simulação automática no build normal, esconder aviso, implementar captura prematuramente.
- Trade-offs: ensaio completo de estados usa build:fixtures; fixtures visuais da sessão são independentes do snapshot mock do popup. Assets de exemplos são excluídos do normal e conferidos na auditoria.
- Status: Consolidada; testes de domínio/renderização e auditoria de bundle realizados; interação no Edge pendente.

## DEC-022 — Settings reais e snapshot mínimo mock

- Contexto: provar persistência de opções e reconciliação sem antecipar banco de áudio/fila.
- Decisão: settings-v1 em storage.local com chave/idioma/retention, defaults validados e salvar explícito. Aplicar TRUSTED_CONTEXTS antes de salvar/ler no settings e no coordenador; falha tratada sem erro bruto/credencial, salvamento bloqueado se restrição falhar. Snapshot mock em chave própria, validado a cada leitura e sem credencial; controle serializado com expectedRevision/recordingId. Sender deve ser página interna conhecida. Sem logs, rede, keepalive ou IDB de áudio.
- Alternativas: globais autoritativos, storage.sync, banco completo já neste bloco.
- Trade-offs: snapshot de mock usa storage.local por exceção mínima; não é formato definitivo de Recording. Não garante transação cross-context para futura captura; UI não escreve snapshot diretamente e mock só possui coordenador. Sem API de restrição, aviso honesto; não dizer que segredo está criptografado ou que chave foi validada.
- Status: Consolidada; persistência/restart por adapters em teste, lifecycle real do Edge ainda pendente.
