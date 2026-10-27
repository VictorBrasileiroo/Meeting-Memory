# Bloco 7A — notas e encerramento automático

27/10/2026. Implementação concluída neste workspace, com build de produção em `dist`. A instalação do usuário e a reunião real de 47min49s não foram abertas nem modificadas. Nenhuma chamada autenticada à Gemini foi executada. Este bloco não inicia novas funcionalidades ou redesign.

## Causas confirmadas

1. `validateNotesOutput` exigia `rawText.includes(quote)` para cada referência. Uma citação inválida, dono/prazo sem suporte, natureza incompatível ou seção duplicada abortava o resultado inteiro. O commit corretamente recusava notas inválidas, mas não havia etapa de recuperação de itens válidos.
2. O adapter transformava todo erro não-Zod da validação em `EVIDENCE`. A fila podia repetir a análise até cinco vezes, inclusive quando o resultado precisava de tratamento local ou ação explícita.
3. O prompt enviava IDs reais longos como referências. Agora envia `p1`, `p2` etc., em ordem determinística. O adapter traduz esses IDs antes de validar e persistir. Não muda o modelo escolhido.
4. `tabCapture.onStatusChanged` encaminhava fim de captura para `INTERRUPT`. O `ended` da aba compartilhava o fluxo do microfone. A sessão parava com `interrupted=true`; os limites das partes e a gravação ficavam parciais, bloqueando corretamente as notas.
5. A recuperação de `STOPPING` aceitava a existência de `endedAt` e alguns chunks como confirmação. Isso não comprovava a finalização integral. Também havia risco de ACK de START atrasado sobrescrever o estado final, e a guarda de encerramento do offscreen considerava jobs, sem consultar a captura viva.

Essas causas são verificadas no código. Sem ler a resposta original da reunião real, não é possível atribuir sua falha a uma citação específica; o diagnóstico antigo não guardou essa distinção.

## Correções das notas

O schema estrito continua sendo uma barreira global. Uma etapa anterior ao commit recupera itens cuja estrutura é válida:

- Correspondência conservadora de espaços/quebras, espaço junto à pontuação, aspas tipográficas e reticências equivalentes. Sempre retorna a substring original. Não corrige palavras, caixa, acentos, nomes, números, prazos ou negações; não apaga vírgulas, pontos de interrogação ou outra pontuação significativa para obter correspondência.
- Correspondência aproximada ambígua é recusada. Uma citação literal repetida continua válida. Não se juntam textos de partes diferentes para fabricar uma referência.
- Uma referência inválida omite somente seu item. Se a citação pertence a outra parte, o item é omitido; não há transferência automática de evidências. As demais notas verificadas permanecem.
- Responsável/prazo exigem suporte na citação do próprio item, com limites de palavra. `Ana` não é comprovada por `Mariana`. A tarefa inteira é omitida se a atribuição falhar, evitando preservar um enunciado que ainda atribua trabalho incorretamente.
- Sugestões/hipóteses declaradas não entram nas seções de decisões. Tarefas continuam exigindo `status: defined`; o perfil Aula não recebe tarefas. Seções repetidas são reunidas e deduplicadas. O limite estrutural de uma seção continua valendo, com aviso se a união excedê-lo.
- Diagnósticos `EVIDENCE_NOT_FOUND`, `WRONG_PART`, `UNKNOWN_PART`, `UNSUPPORTED_OWNER`, `UNSUPPORTED_DEADLINE`, `INVALID_NATURE`, `DUPLICATE_SECTION`, `TASKS_OUTSIDE_PROFILE` e `SECTION_LIMIT` usam somente enums e contagens. Não armazenam texto da fonte, resposta bruta, nomes, chave ou IDs de itens no relatório de validação.
- O aviso de limitações aparece nas notas e também na cópia/exportação Markdown. Um resultado sem itens retidos recebe título nulo e explicita as omissões.
- JSON/schema/incomplete conhecidos passam a exigir retry explícito. Recuperações locais não provocam nova chamada. Backoff, leases e limite finito para falhas transitórias de rede continuam funcionando.

`validateNotesOutput` permanece estrita como segunda barreira dentro da transação. Notas, relatório sanitizado, conclusão do job e estado da gravação são gravados no mesmo commit. Resultado válido existente não é sobrescrito.

Limite: correspondência lexical não prova toda a semântica de uma paráfrase da LLM. A política anti-invenção, os campos de natureza e a consulta da fonte permanecem necessários. Esta entrega não afirma eliminar qualquer possível interpretação incorreta do modelo.

## Correções da captura

`tabs.onRemoved` identifica o alvo salvo. Os eventos de aba, status e comandos passam pela fila serial do background. A confirmação de `ended` consulta o background fora dessa fila, para que um STOP aguardando resposta não cause deadlock. O fechamento é comprovado pelo evento do alvo ou pela ausência na lista de abas; uma falha da API não conta como fechamento. Há uma segunda conferência após 150 ms quando o navegador ainda enumera uma aba em encerramento.

`CaptureSession` e `RotatingRecorder` compartilham a promessa de STOP. Fechamento automático, `ended` e STOP manual concorrentes não iniciam outro gravador nem outro flush. Falhas de microfone/recorder/armazenamento dominam o resultado enquanto a fonte está sendo finalizada. A limpeza deliberada dos dispositivos não é classificada como falha de fonte.

A finalização aguarda o evento `stop`, o último `dataavailable`, as escritas pendentes e todas as partes em rotação, inclusive no overlap. Verifica sequência e quantidade de fragmentos antes de montar o Blob. Ausência de confirmação de STOP expira em 15 segundos e conserva o material como parcial. Falha de montagem/commit preserva os fragmentos já salvos.

Antes de declarar `COMPLETE`, verifica cabeçalho EBML/WebM, bytes, certificado de finalização, índices, ausência de fragmentos pendentes, limites observados, overlap e continuidade temporal. O estado final é persistido em transação com releitura da fonte e da proteção contra exclusão. Um ACK atrasado de START não pode ressuscitar `RECORDING`; o início observado pelo offscreen permite finalizar mesmo antes desse ACK.

Essa integridade é estrutural e cobre os dados emitidos pelo gravador e persistidos. O runtime não decodifica integralmente todos os arquivos longos nem mede a qualidade do sinal. O ensaio nativo decodificou os WebMs sintéticos; a escuta do áudio de uma aba real continua no roteiro manual.

Somente uma fonte comprovada entra em `PROCESSING`. A recuperação relê esse commit se a mensagem ou o worker se perder; chunks parciais não são promovidos. Microfone encerrado, recorder com erro, armazenamento falho ou offscreen desaparecido continuam parciais e sem análise automática. Havendo partes salvas, a falha conserva o acesso à revisão. O offscreen não fecha enquanto a captura está ativa/finalizando ou há jobs pendentes.

O motivo `TAB_CLOSED` é durável e aparece no popup e na sessão: “Gravação encerrada automaticamente porque a aba foi fechada”. Não se confunde com `SOURCE_LOST`.

Nas novas partes com certificado, a retenção existente aguarda o commit das notas antes de liberar áudio transcrito. Assim, uma falha de análise ou gravação parcial conserva o áudio. Após notas e limpeza remota concluídas, a preferência “Apagar áudio após transcrever” segue sua política existente; “Manter gravação local” continua preservando-o. Não há novo modo de retenção ou limpeza geral. Áudio já apagado pela política anterior não pode ser restaurado por esta atualização.

## Invariantes preservados

- IndexedDB continua na versão 5. Campos opcionais são aditivos; não há migração destrutiva, reescrita de sessões antigas ou limpeza de dados.
- Transcrição original, modelo fixado, endpoint, `store:false`, prompt anti-invenção, limite de contexto sem truncamento e ausência de fallback automático.
- Upload, transcrição, parser e limitador da transcrição conservados. Áudio já transcrito não é reenviado no retry de notas.
- Leases, generations, source key, exclusão protegida por marcador, jobs únicos e commits atômicos. Os testes anteriores mantêm suas expectativas; nos arquivos antigos de testes só foram acrescentados casos.
- Manifest, permissões, CSP, dependências, fontes e assets locais preservados. Não há nova permissão `tabs`; os IDs/eventos e a enumeração de abas não leem URLs para classificar fechamento.
- Direção Áudio × Papel e fluxos existentes. Apenas avisos funcionais foram acrescentados. Sem lixeira, backup, importação, pastas, renomeação ou cancelamento.

Evidência por hashes: `.verification/block-7a/preservation.json`; não há Git e não foi alegado diff/commit.

## Verificações executadas

- `npm.cmd run typecheck`: aprovado, também executado pelos builds finais.
- `npm.cmd run lint`: aprovado.
- `npm.cmd test`: **322 testes em 36 arquivos aprovados**.
- `npm.cmd run build`: aprovado; auditoria MV3/CSP aprovada para 8 entrypoints e 42 artefatos locais de código.
- `npm.cmd run build:fixtures`: aprovado; auditoria aprovada para 53 artefatos locais.

Regressões novas: duas partes sintéticas longas (mais de 490 mil caracteres), falas sem espaço depois de ponto, aspas e espaços, ambiguidade, partes erradas/desconhecidas, números, nomes, prazos, negações, tarefa mal atribuída, natureza, seções repetidas, limites e commit parcial seguro. SDK real com HTTP interceptado, sem Gemini real, confirma aliases e modelo. Retry de sessão antiga completa conserva transcrições e jobs de transcrição concluídos.

Captura: encerramento antes do primeiro fragmento, normal, antes/durante/depois da rotação, STOP nas duas ordens, `ended` antes do evento de remoção, microfone, recorder, armazenamento, fragmento faltante, timeout, cabeçalho inválido, recuperação de estado e START atrasado. A fila do service worker tem teste separado para concorrência e consulta sem deadlock.

Edge real em perfil isolado: sete cenários com oscilador WebAudio, MediaRecorder, IndexedDB e decodificação de WebM reais. Normal, overlap, após rotação, STOP concorrente e `ended` de aba confirmado concluíram; falha de microfone permaneceu parcial com áudio decodificável. No encerramento aos 80 ms, o navegador produziu parte vazia: a sessão permaneceu parcial e não foi apresentada como íntegra. Eventos `ended` foram disparados sinteticamente nesses streams; esse ensaio não substitui `tabCapture` e fechamento real de aba da extensão instalada. Dados em `.verification/block-7a/native-audio.json`.

Logs, harnesses e capturas ficam em `.verification/block-7a/`. O primeiro ensaio de adapters travou por timers simulados também interceptarem o agendamento do IndexedDB; o harness passou a simular somente Date/setTimeout/clearTimeout. Os registros iniciais não são apresentados como aprovações.

Conferência consolidada aprovada em `.verification/block-7a/signoff.json`: 127 arquivos anteriores intactos, 19 alterados, 8 novos e nenhum removido no conjunto funcional/testes/configuração acompanhado pelos hashes.

## Inspeção e revisão de interface

Frontend-skill aplicada à integração discreta dos avisos. Tese anterior à edição: conservar navy/papel e a leitura como foco, com motivo junto ao estado e limitações junto às notas. Não foi introduzida animação ou navegação nova.

Capturas `first-session-1280.png`, `first-session-375.png` e `first-popup-processing-420.png` foram abertas e inspecionadas. Observação: aviso de omissões com aparência de rodapé e motivo desalinhado com a coluna no desktop. Refinamento: rótulo “Notas com limitações”, corpo de 14px e alinhamento do motivo com a leitura; no popup, estado antes do motivo. Capturas `final-*` foram renderizadas e abertas novamente, inclusive evidência por teclado. A hierarquia e a identidade atuais foram preservadas.

Revisão Vercel com [diretrizes atuais](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), consultadas em 27/10/2026, sobre os avisos e sua integração:

- `src/session/NotesContent.tsx`: aviso anunciado com status/live region, omissões explícitas, fontes nativas por details/summary e retorno de foco preservado.
- `src/session/SessionResult.tsx` e `results.css`: motivo textual persistente, alinhado, sem depender de cor e sem overflow nas larguras verificadas.
- `src/popup/PopupApp.tsx`: motivo legível abaixo do estado; controles existentes mantidos.
- `src/session/notes-export.ts`: limitação acompanha o conteúdo copiado/exportado.

`final-browser.json` registra sessão a 1280/375/320px e popup em processamento/concluído a 420/320px, sem overflow, exceções ou requisições remotas da página. Para reflow do popup a 320px, o harness remove somente a classe que fixa a janela nativa em 420px, como nos ensaios anteriores. `accessibility.json` registra Enter no disclosure, foco visível e zero controles sem nome na árvore acessível. São verificações direcionadas, não auditoria completa com leitor de tela.

O primeiro ensaio de reflow do popup interrompeu justamente por não remover essa classe fixa; foi corrigido o harness, sem mudar a largura nativa do produto. As capturas iniciais da sessão continuam válidas para comparar o refinamento dos avisos.

Limitação CSP preexistente: a prévia de sessão continua registrando a sondagem de `eval` bloqueada do Zod. Não se declarou zero violações. O bundle Zod tem SHA-256 `d186ed4aeadd11bb5c0a8ab2523f78750cae5fddc718b31402dfcb85dd5016d8`, igual ao registrado antes deste bloco. Nenhuma permissão/CSP/dependência foi alterada para acomodá-la. Os eventos brutos permanecem nos JSONs.

## Atualizar sem apagar sessões

1. Termine uma captura ativa e aguarde o processamento que estiver em andamento antes da recarga.
2. Use o conteúdo de `dist`, o build de produção, na mesma pasta de instalação da extensão. Não instale `dist-dev` ou uma segunda cópia para atualizar.
3. Em `edge://extensions`, habilite o modo de desenvolvedor se necessário e clique em **Recarregar** no mesmo cartão de Meeting Memory. Não remova/reinstale a extensão nem limpe os dados do perfil.
4. Reabra a biblioteca e a sessão. A mesma identidade da extensão mantém IndexedDB e configurações. Se precisar copiar os arquivos para a pasta originalmente usada, mantenha essa mesma entrada instalada.

## Reprocessar a reunião de 47min49s

1. Após a atualização, abra **Reuniões e armazenamento** e selecione a reunião que falhou.
2. Confira as duas partes na aba **Transcrição**. O conserto não exige regravação ou retranscrição.
3. Abra **Detalhes do processamento** e clique em **Reprocessar somente as notas**. Essa ação usa a transcrição salva e o modelo da análise, inclusive Lite quando já era o modelo utilizado.
4. Aguarde a nova análise. Se houver omissões, as notas verificadas aparecerão acompanhadas do aviso e dos códigos/contagens em **Sobre estas notas**.

Não é necessário usar “Testar integração” nem escolher outro modelo. O retry de notas pode gerar cobrança, mas não envia áudio já transcrito. A elegibilidade continua exigindo gravação completa, todas as transcrições e job de análise com falha terminal; não se força uma sessão parcial a passar. A sessão real não foi acessada para executar esse retry durante a implementação.

## Ensaios manuais restantes no Edge instalado

Em uma reunião de teste, com a retenção “Manter gravação local”, conferir:

1. Fechar a aba capturada em menos de 5 segundos (antes do primeiro timeslice), depois em gravação normal. Se o navegador não produzir áudio válido no caso muito curto, esperar parcial e acesso ao material disponível; com fonte válida, esperar processamento automático e motivo do encerramento.
2. Fechar perto da rotação de produção, a cada 29min30s, e durante o overlap de 1 segundo. Alternativamente, usar o build de teste isolado em outro perfil para o ensaio curto, sem substituir a instalação com sessões reais.
3. Disparar Finalizar e fechar a aba quase simultaneamente, nas duas ordens. Conferir uma finalização por parte, áudio final audível e um único job de notas.
4. Suspender/reiniciar o service worker enquanto o offscreen permanece vivo; depois fechar a aba. Conferir recuperação e processamento. Separadamente, encerrar inesperadamente o offscreen: esperar parcial, nunca promoção automática sem commit comprovado.
5. Desconectar o microfone/forçar erro de captura e comparar com fechamento normal. Conferir estado parcial, fonte preservada e ausência de notas finais automáticas.
6. Usar chave ausente ou falha de análise em sessão de teste; confirmar áudio preservado e retry de notas sem retranscrição. Não é preciso provocar cobrança ou falha na reunião real.
7. Confirmar o fluxo real de notas da reunião de 47min49s, navegação das evidências e inspeção por Narrator/zoom do Edge. Esses ensaios de extensão, hardware e Gemini autenticada não foram declarados como realizados.

## Reprodução dos ensaios locais

Depois dos comandos npm acima: `node .verification/block-7a/prepare-browser.mjs`; `node .verification/block-7a/server.mjs` serve a prévia local na porta 5187 com a CSP original. Abrir Edge headless em perfil separado dentro de `.verification/block-7a/`, sem extensões/sync, com debugging na porta 9248 e autoplay local permitido. Então executar `node .verification/block-7a/check-browser.mjs final`, `node .verification/block-7a/check-a11y.mjs` e `node .verification/block-7a/preservation.mjs`.

Nesta máquina o navegador precisou executar fora do sandbox do shell para iniciar seus subprocessos. O perfil permaneceu isolado e os testes usaram somente fixtures e osciladores. Não se utilizou o perfil habitual do usuário nem se capturou microfone físico.
