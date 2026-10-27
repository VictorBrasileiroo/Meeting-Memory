# Arquitetura atual

Referência da beta em preparação, após o Bloco 7C. A [evolução histórica](ARCHITECTURE.md) e o [registro de decisões](DECISIONS.md) preservam a justificativa das escolhas. Este documento descreve o código atual, sem propor refatoração.

## Superfícies e coordenação

`popup`, `settings`, `session` e `library` são páginas React locais. O popup controla a sessão ativa; configurações guardam preferências e chave do usuário; sessão consulta notas/transcrição/áudio; biblioteca mede conteúdo e executa limpeza manual. `microphone` solicita a concessão visível do navegador; `review` permite consultar material disponível.

O service worker em `src/background/` valida mensagens e remetentes, serializa comandos e relê o estado durável. Protocolos de captura e gerenciamento possuem schemas separados. Não há servidor próprio, content script ou chave embutida no build.

O documento offscreen mantém a captura fora do popup e cria um Dedicated Worker local para jobs. Fechar o popup não encerra a gravação. A ausência/perda do offscreen não é tratada como prova de gravação completa.

## Captura e processamento

`src/capture/` mistura áudio da aba e microfone com WebAudio e usa MediaRecorder para produzir partes WebM independentes. A rotação de produção tem alvo de 29min30s e sobreposição planejada de 1s. Tempos observados, fragmentos e confirmação de finalização são persistidos; limites estruturais e cabeçalho são verificados antes de declarar completude.

`src/queue/` reclama jobs no IndexedDB com lease/generation, heartbeat, backoff e limite finito de tentativas. O fluxo normal transcreve partes progressivamente e só gera notas quando a captura está íntegra e todas as transcrições necessárias estão persistidas. Reinício recupera material/jobs, sem reiniciar automaticamente o stream de áudio.

`src/gemini/` usa `@google/genai` 2.24.0 para upload Files, transcrição e análise textual via Interactions. `store:false` é enviado nas interações. Modelos estão fixados no código/por sessão conforme os contratos existentes; não há fallback automático de modelo. Um job separado tenta excluir o arquivo remoto depois do commit da transcrição. Exclusão local não garante conclusão imediata da limpeza remota.

`src/domain/` define perfis, estados e schemas. Notas são validadas estruturalmente e contra a fonte; itens sem suporte confiável podem ser omitidos com relatório de limitações. A transcrição original é preservada. A verificação lexical não comprova toda a semântica de uma interpretação do modelo.

## Dados e exclusão

- `chrome.storage.local`: chave, preferências e snapshot de coordenação. Acesso restrito a contextos confiáveis; sem sincronização e sem criptografia adicional do aplicativo.
- IndexedDB `meeting-memory`, **versão 5**: gravações, partes, fragmentos, transcrições, resultados, jobs, sessão ativa, limitador de transcrição e marcadores de exclusão.
- Transações mantêm commits de conteúdo e estados relacionados juntos. Leases/generations impedem gravações tardias por executores antigos; marcadores impedem recriação de reuniões excluídas.
- A biblioteca revalida elegibilidade dentro da transação de exclusão. Áudio removível exige transcrição e limpeza remota correspondentes; exclusão de reunião mantém o mínimo necessário à limpeza remota conhecida.
- Retenção local respeita a preferência da sessão e os commits necessários. Material já apagado não é recuperável. Não há lixeira ou backup implementado.

## Build e segurança

Manifest V3 com `storage`, `activeTab`, `tabCapture` e `offscreen`; host restrito à Gemini. Scripts, estilos, fontes e worker são empacotados localmente. A CSP não inclui `unsafe-eval` nem `unsafe-inline`. A sondagem capturada de eval do Zod pode gerar evento de bloqueio em alguns contextos; o parser usa seu fallback. Isso não autoriza relaxar a política.

Vite tem oito entrypoints de produção. `foundation-mock` adiciona a galeria e fixtures; `chunk-test` e `transcription-diagnostic` são builds separados. A auditoria de produção verifica imports/assets locais, manifest, permissões e ausência de fixtures/diagnósticos naquele pacote. Essa auditoria estática tem limites documentados nos relatórios 7B/7B.1.

Zod 4.6.7 e Vite 8.3.5 substituem as versões vulneráveis do início do 7B. React, UI, SDK, modelos, contratos e schema IndexedDB foram preservados. Veja [privacidade](PRIVACY.md), [testes](TESTING.md) e [parecer de publicação](BLOCK_7C_PUBLICATION.md).
