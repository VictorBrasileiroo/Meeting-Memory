# Reuniões e armazenamento

Implementado em 20/10/2026 por pedido expresso do usuário. Esta autorização amplia o escopo anterior de apresentação para consulta e gerenciamento manual. O pacote de design orienta a aparência; o plano aprovado pelo usuário define as funções e a segurança.

## Uso

Acesse pelo ícone de biblioteca no cabeçalho do popup, pelo link **Reuniões e armazenamento** nas configurações ou pelo acesso **Reuniões** na sessão. Em telas estreitas a sessão mostra somente o ícone, com nome acessível. A biblioteca usa navegação navy e superfície papel da direção Áudio × Papel.

Busque por título, perfil ou data; filtre estado e áudio local; ordene por mais recentes, mais antigas ou maiores. São 30 reuniões por página. Seleção individual e da página atual é preservada entre páginas; busca/filtros limpam a seleção. Busca, filtros, ordenação e página ficam na URL e no retorno da sessão.

**Remover áudio** preserva notas e transcrição. Só é permitido depois de transcrever as partes retidas e concluir sua limpeza remota, usando os critérios de `releaseAudio`. Fragmentos de captura ainda preservados impedem essa ação. Áudio removido não pode mais ser ouvido nem retranscrito.

**Excluir reunião** remove áudio, notas, transcrição, fragmentos associados e registros locais relacionados. A confirmação informa conteúdo estimado, reuniões elegíveis e impedidas com motivos. Não há desfazer. Gravação, transcrição, análise, novas tentativas automáticas e espera por credenciais de conteúdo protegem a reunião. Falhas encerradas podem ser excluídas; limpeza remota isolada pode continuar depois da exclusão local.

Lotes processam uma reunião por vez, com progresso e resultado por item. Falhas continuam no diálogo e selecionadas para nova tentativa. A elegibilidade é revalidada dentro da transação; uma reunião que mudou depois da confirmação recebe resultado explícito. Mantenha a página aberta durante o lote. Não há limpeza automática nova, cancelamento, lixeira, backup restaurável, importação, pastas ou edição de título. A retenção automática existente permanece.

## Espaço e persistência

Uso/quota do navegador são estimativas da origem da extensão via `navigator.storage.estimate()`. Quando indisponíveis, a tela informa isso e a lista continua funcionando. Liberar conteúdo pode demorar para aparecer no uso informado. A quota não representa espaço livre no computador.

A lista leve é exibida antes da medição. Cursores verificam até 100 registros por transação readonly, sem carregar todos os áudios, decodificar ou chamar `arrayBuffer()`. Contam os `Blob.size` atuais, inclusive fragmentos atribuíveis: áudio já descartado vale zero, independentemente de tamanhos históricos de upload. Texto UTF-8 e metadados são estimados separadamente. A soma por reunião é **conteúdo estimado**, não tamanho físico exato do IndexedDB. Ordenação por tamanho e operações ficam disponíveis após medição completa; as estimativas são refeitas após operações. Áudio temporário sem reunião associada é informado e preservado.

Migração aditiva v4→v5 acrescenta somente a store `meetingDeletions`, sem reescrever o conteúdo existente. Cada marcador contém ID e data de exclusão. A exclusão grava o marcador, remove a cascata e limpa a sessão ativa em uma única transação por reunião. Writers, claims, retries, commits e reconciliação consultam marcadores, impedindo recriação por respostas atrasadas. O marcador mínimo permanece após a limpeza.

Identidades remotas conhecidas conservam ou recebem jobs duráveis de limpeza. Claims, credenciais e retries de limpeza continuam operáveis sem a reunião reaparecer na biblioteca; jobs concluídos de reuniões excluídas são compactados. A interface informa pendências, falhas e espera por credenciais. Exclusão local não promete exclusão remota instantânea nem representa toda a política de retenção do provedor.

Mensagens tipadas `REMOVE_RECORDING_AUDIO`/`DELETE_RECORDING` têm validação própria, remetente restrito à biblioteca e revisão esperada. Mutações passam pela fila serial do background, com revalidação transacional dos jobs e da gravação. Contratos anteriores não mudaram. Como Chrome storage e IndexedDB não compartilham transação, GET e atualização de credenciais reparam um snapshot antigo pelo marcador caso o worker pare após a exclusão. BroadcastChannel atualiza outras páginas; a sessão conserva seu polling e revoga URLs de áudio abertas.

## Design, inspeção e refinamento

Frontend-skill aplicada. Tese definida antes da edição: um índice de documentos no papel, com navegação navy e armazenamento discreto. Hierarquia: título → resumo de espaço → busca/filtros → seleção → lista contínua. Ações abrem diálogo; foco inicial em Voltar, retorno ao gatilho ou ao título caso a linha desapareça. Sem cards por reunião nem visual promocional.

As capturas foram renderizadas e **abertas para inspeção** em desktop e celular, antes e depois dos ajustes:

| Observação | Ajuste | Evidência em `.verification/management/` |
| --- | --- | --- |
| Espaço e filtros empurravam toda a lista para baixo no celular | Disclosures nativos fechados inicialmente no celular | `first-mobile.png`, `refined-mobile.png`, `final-mobile.png` |
| Seletores cortavam texto no desktop; utility reabria o resumo oculto | Grid próprio e regra na camada final do CSS | `first-desktop.png`, `refined-desktop.png`, `refined2-desktop.png`, `final-desktop.png` |
| Títulos e ações precisavam respirar em 320px | Linhas responsivas em duas colunas e quebra de títulos | `first-narrow.png`, `refined2-narrow.png`, `final-narrow.png` |
| Mensagem singular do lote usava plural | Concordância do resultado por quantidade | `final-partial-failure.png` |
| Link no rodapé fazia o popup superar 600px | Ícone acessível no cabeçalho; altura final 568,53px | `entry-popup.png`, `entry-links.json` |
| Navegação da sessão quebrava em três linhas | Rótulos compactados em larguras pequenas | `entry-session.png` |

Capturas adicionais: `final-batch-preview.png`, `native-library-desktop.png`, `native-library-mobile.png`, `final-touch-mobile.png`, `final-forced-colors.png`. A prévia identifica dados fictícios. As capturas nativas usam reuniões sintéticas identificadas, em origem HTTP isolada.

Revisão Vercel com [diretrizes atuais](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) consultadas novamente em 20/10/2026. Achados por arquivo/linha e correções em [vercel-review.md](../.verification/management/vercel-review.md). Checados nomes/rótulos, teclado, foco, diálogos, estados vazios/erro, textos longos, responsividade, links, URL, datas/números locais, reduced motion e forced colors. Dez pares de contraste aprovados; 61 controles de toque medidos ≥44px e zero controles anônimos na árvore AX. Não é auditoria completa de acessibilidade.

## Validação

**279 testes em 32 arquivos**, lint e typecheck aprovados. Build normal e de fixtures com auditoria: 42 e 53 artefatos de código locais, respectivamente; oito entradas obrigatórias, incluindo biblioteca. Manifest, CSP, permissões, dependências e exportação de notas preservados por SHA-256. Vinte e seis dos 30 arquivos anteriores de núcleo/manifest permanecem idênticos; quatro receberam somente a integração necessária de armazenamento/background/allowlist. Vinte e nove arquivos anteriores de testes são idênticos; nos outros dois, a única alteração semântica é a versão esperada do banco de 4 para 5, comprovada por hash após reversão desse literal. Os testes anteriores não foram reescritos para acomodar regressões.

Cobertura nova inclui migração, lista leve, contagem atual/fragmentos/áudio vazio, varredura abortável, áudio sem perda de texto, cascata isolada, rollback, concorrência, mudanças de elegibilidade, proteção de retries/credenciais, claims/commits atrasados, reabertura e limpeza remota depois da exclusão.

Edge 155.0.4283.62 headless com perfil isolado e CSP original:

- **10 verificações integradas nativas:** migração v4→v5, tamanhos reais de Blobs, commit de áudio pela UI de produção com igualdade das notas/transcrição, cascata e reabertura, lote misto/conflito/repetição, mudança após confirmação, duas páginas, revogação de áudio aberto, sessão excluída/snapshot e estimate indisponível.
- **30 combinações da biblioteca:** seis larguras (320–1440px), cinco cenários, filtros expandidos, teclado, seleção entre páginas, falha parcial e repetição.
- **75 combinações de regressão dos resultados:** notas/fontes, foco, histórico/IDs explícitos, cópia/exportação, recuperação e áudio sob demanda.

Relatórios finais não registraram exceções ou requisições remotas. A suite nativa terminou com zero eventos de CSP. Os harnesses de fixtures e regressão preservam 42 e 82 eventos, respectivamente, do probe de `eval` do Zod bloqueado pela CSP, já existente antes deste recurso. Por isso esses dois comandos brutos retornam 1 apesar das asserções funcionais passarem. O bundle `zod-B_CUhVoG.js` permanece byte a byte igual ao arquivo anterior em `dist-dev.zip`, SHA-256 `d186ed4aeadd11bb5c0a8ab2523f78750cae5fddc718b31402dfcb85dd5016d8`; não houve relaxamento da CSP nem mudança de dependência. Classificação e prova em `summary.json` e `zod-baseline.json`; eventos brutos não foram suprimidos.

Artefatos em `.verification/management/`: `baseline.json`, `source-hashes.json`, `preservation.json`, `contrast.json`, `summary.json`, `native-checks.json`, `ui-checks.json`, `browser-checks.json`, logs `final-*.log`, scripts e capturas. A pasta não tem Git: nenhuma alegação de diff/commit é feita. Arquivos `*-failure.json` guardam diagnósticos históricos do desenvolvimento dos harnesses; os relatórios finais acima são a evidência da entrega.

## Reprodução e limites

Na raiz, execute `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` e `npm.cmd run build:fixtures` (os builds incluem typecheck e auditoria). Não é necessário instalar dependências novas.

Para repetir a verificação visual, inicie `node .verification/management/server.mjs` (porta 5182). Abra Edge com perfil dedicado dentro de `.verification/management/edge-profile`, depuração em 9241, extensões desabilitadas e sem sincronização. Em PowerShell, use Start-Process com WindowStyle Hidden. Então:

```powershell
node .verification/management/build-native.mjs
node .verification/management/check-native.mjs
node .verification/management/check-ui.mjs
node .verification/management/check-results.mjs
node .verification/management/check-entry-links.mjs
node .verification/management/finalize-evidence.mjs
```

Os harnesses usam exclusivamente `http://127.0.0.1:5182`; o reset do banco de fixtures é bloqueado fora de `/test/` nessa origem. Fixtures de gerenciamento são excluídas do build normal. `update-docs.mjs` é registro de edição, para executar uma única vez; não faz parte da reprodução dos testes.

Limites reais: APIs Chrome/runtime/offscreen/credenciais são simuladas, mesmo na suite com IndexedDB nativo e código real de persistência/background. Reabertura e interrupção de snapshot foram simuladas; não se validou reinício do sistema operacional ou ciclo completo do service worker instalado. Não houve acesso à instalação, gravações, chave ou API autenticada do usuário. Narrator, zoom pelo menu e popup instalado continuam sem validação manual.

Build pronto em `dist/`. Para usar na instalação existente, finalize gravações/processamento, feche páginas antigas da extensão e recarregue **a mesma extensão** apontando para essa pasta. Não remova/reinstale a extensão nem limpe seu banco para atualizar. A migração é aditiva, mas um build antigo limitado a v4 não abre um banco já migrado para v5. Se outra página antiga bloquear a migração, a interface orienta fechá-la e atualizar.
