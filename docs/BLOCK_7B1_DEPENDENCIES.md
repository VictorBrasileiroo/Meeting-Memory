# Bloco 7B.1 — correções de dependências

27/10/2026 · Node 22.23.2 · npm 11.1.0 · Windows · Edge headless 156.0.4314.42.

> Registro da correção 7B.1. No [Bloco 7C](BLOCK_7C_PUBLICATION.md), o titular escolheu MIT e a licença foi aplicada. Pendências de licença abaixo são históricas; resultados técnicos desta etapa permanecem preservados.

## Resultado

**Bloqueios B1 e B2 da auditoria 7B encerrados.** Atualizações pontuais de Zod e Vite, instalação limpa e regressão aprovadas. As consultas `npm audit --audit-level=high` e `npm audit --omit=dev --audit-level=high` terminaram com código 0 e **zero vulnerabilidades em todas as severidades** na data acima. Isso é uma consulta aos advisories conhecidos, não garantia universal de segurança.

Nenhum arquivo de `src/`, `public/`, `scripts/`, testes anteriores ou configuração de Vite/TypeScript/lint foi alterado. CSP, permissões, modelos Gemini, IndexedDB v5, contratos, fluxos e design foram preservados. Não houve repositório remoto, commit, tag, release ou publicação.

## Versões e escopo do lockfile

| Pacote direto | Anterior | Atual | Decisão |
| --- | --- | --- | --- |
| Zod | 4.6.5 | **4.6.7** | Último patch 4.6.x disponível na consulta; acima da correção mínima 4.6.6 |
| Vite | 8.3.2 | **8.3.5** | Último patch 8.3.x disponível na consulta; mantém linha/compatibilidade existente |

Versões exatas em `package.json`, sem `^` ou `~`. Nenhuma outra dependência direta mudou. Vite 8.3.5 requer `rolldown ~1.2.14` e `postcss ^8.5.30`, acima das versões antigas; o resolvedor escolheu Rolldown 1.2.15 e PostCSS 8.5.32. Transitivas relacionadas: `@oxc-project/types` 0.152.0 → 0.155.0, bindings de plataforma Rolldown 1.2.12 → 1.2.15 e nanoid 3.3.19 → 3.3.20 (exigido pelo PostCSS escolhido). No Windows foram trocados sete pacotes instalados, incluindo Zod/Vite; as entradas de outros bindings permanecem no lockfile para as plataformas correspondentes.

Nenhum upgrade de React, React DOM, Radix, Tailwind, Lucide, Vitest, TypeScript ou `@google/genai`. Foi removida da proposta inicial do resolvedor apenas a inclusão incidental de seis metadados de dependências já bundled do Tailwind WASI; nenhum pacote dessa árvore foi atualizado. O lockfile final passou em novo `npm ci` e permaneceu byte a byte inalterado durante a regressão. `lock-review.json` confere o conjunto permitido de alterações. Não foi utilizado `npm audit fix` nem `--force`.

O npm foi consultado por `npm view zod@4.6 ...`, `npm view vite@8.3 ...` e auditorias antes/depois. Metadados, integridades e peers foram registrados localmente; o Node e os plugins atuais atendem aos requisitos do Vite selecionado. [Changelog oficial do Vite 8.3.5](https://github.com/vitejs/vite/blob/v8.3.5/packages/vite/CHANGELOG.md).

## Advisories encerrados

| Pacote | Advisory anterior | Resultado no lockfile atual |
| --- | --- | --- |
| Zod | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), consumo de memória em coleções | Não reportado; patch e ensaio de rejeição antecipada verificados |
| Vite | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), bypass de verificação no Windows | Não reportado |
| Vite | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), escape de argumentos no Windows | Não reportado |
| Vite | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), interpretação de flags do editor | Não reportado |
| Vite | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), execução de script entre origens em middleware | Não reportado |
| Vite | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), arquivos fora de server.fs.allow | Não reportado |
| Vite | [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg), exposição por vite-wasm-instance | Não reportado |

Antes: dois pacotes com maior severidade alta; depois: zero vulnerabilidades na árvore completa e na de produção. Os problemas do Vite pertenciam ao ambiente de desenvolvimento, não a endpoints embarcados na extensão.

## Dados externos e consumo de memória

A revisão encontrou **todos os seis arrays Zod existentes com teto explícito**. Não foi necessário alterar schemas de negócio:

| Entrada | Limites existentes preservados |
| --- | --- |
| Notas da Gemini (`notes.ts`) | Resumo 30; seções 24; itens por seção 200; tarefas 200; evidências por item 12 |
| Texto de notas/citações | 1–6.000 caracteres após trim |
| Relatório de validação (`notes-validation.ts`) | Até 9 códigos; contagens limitadas a 6.000/72.000 conforme o campo |
| Configurações e mensagens | Chave até 256 caracteres; objetos estritos, enums e UUIDs nos identificadores dos envelopes; sem coleções Zod abertas |

O patch do Zod verifica limites superiores de coleções antes de percorrer filhos. Ensaio com o mesmo array sintético de 1.000 objetos inválidos e máximo 3: **4.6.5 leu 1.000 elementos e gerou 1.001 erros; 4.6.7 leu zero elementos e gerou um erro de tamanho**. As 11 novas regressões exercitam os cinco limites de notas com 50.000 elementos sem ler suas propriedades, preservam a aceitação no limite/recusa do próximo elemento e cobrem o array de diagnósticos. Não se baseiam em limites de tempo frágeis nem em um ensaio destrutivo de esgotamento de memória.

Isso não elimina todo consumo excessivo: o SDK e `JSON.parse` podem materializar o corpo antes de Zod; limites por campo/coleção não constituem um orçamento global de bytes. Identificadores textuais de evidência e alguns campos internos não têm teto próprio. A saída de notas solicita 65.536 tokens, mas esse pedido ao provedor não é uma barreira local de transporte. A transcrição usa parser próprio com `output_text` e annotations, sem Zod e sem teto local global de corpo. Não foi imposto truncamento ou limite arbitrário que pudesse perder falas/diarização de reuniões longas. Limites totais de transporte e diagnóstico podem ser considerados em trabalho posterior, com critérios de produto e recuperação explícitos.

Os JSON Schemas gerados para os **quatro perfis foram comparados antes/depois e são idênticos**. Prompts, modelos, formatos enviados ao SDK, regras de evidência e persistência não foram modificados.

## CSP e sondagem de eval

CSP/manifest idênticos por hash. Zod 4.6.7 mantém a sondagem capturada de `Function` e o fallback para interpretador; o patch de memória é independente disso. Em página e worker isolados sob a CSP original, entradas válidas foram aceitas e inválidas recusadas. No modo padrão houve um evento `eval` bloqueado por contexto; configurar `jitless` antes dos schemas eliminou os eventos nesse ensaio.

Nos bundles reais de prévia, sessão e biblioteca ainda registraram a sondagem conhecida, capturada, sem falha de interação. Popup e configurações de produção verificados não registraram eventos. **Não se declara zero violações de CSP em todas as telas.** O bootstrap visual existente e a separação de chunks foram preservados; não foram adicionados `unsafe-eval`, código remoto, patch em node_modules ou alteração de ordem de inicialização para mascarar eventos. O ensaio HTTP com mesma CSP não equivale a instalar todos os contextos MV3.

## Regressão executada

Nova cópia em `.verification/block-7b1/clean-source`, criada somente dos arquivos candidatos, sem `node_modules`, perfis ou builds. Instalação via `npm ci --no-audit --fund=false`, seguida de um novo `npm ci --offline` após reduzir os metadados incidentais do lockfile. Ambos aprovados; 228 pacotes instalados. A cópia offline usou os tarballs do cache com integridades do lockfile, sem copiar uma instalação pronta. O workspace também foi alinhado ao lockfile e seu `dist` de produção reconstruído.

| Comando / ensaio | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado na cópia limpa e no build do workspace |
| `npm run lint` | Aprovado, zero avisos |
| `npm test` | **333 testes em 37 arquivos**, incluindo os 322 anteriores intactos |
| `npm run build` | Aprovado na cópia limpa e workspace |
| `npm run audit:dist` | Aprovado; 8 entrypoints e 42 artefatos de código de produção |
| `npm run build:fixtures` | Aprovado; simulação separada, sem contaminar produção |
| `npm run build:chunk-test` | Aprovado; apenas build, sem envio à API |
| `npm run build:diagnostic` | Aprovado; diagnóstico fora do build normal |
| `npm audit --audit-level=high` | Código 0, zero vulnerabilidades |
| `npm audit --omit=dev --audit-level=high` | Código 0, zero vulnerabilidades |
| `npm run test:idb:edge` | Aprovado em perfil de teste: schema, transação/abort, índice único, fragmentos, lease, generation e reopen |
| Entradas Vite/dev | Oito inputs de produção preservados; oito respostas HTTP 200 no Vite de desenvolvimento, inclusive worker |
| Reprodução do build atualizado | 50 arquivos completos, hashes idênticos entre instalação limpa e workspace |
| JSON Schemas de notas | Quatro perfis idênticos antes/depois |
| Edge / UI empacotada | Sessão a 1280/375px: abas, fonte e retorno de foco; biblioteca: paginação e diálogo Radix; configurações: leitura/salvamento fictícios; popup: inicialização. Zero exceções JS, zero requisições remotas e sem overflow nas larguras verificadas |
| Edge / captura nativa sintética | Sete cenários com WebAudio, MediaRecorder, IndexedDB e decodificação WebM, usando o Rolldown atualizado |

Captura sintética: finalização normal, durante/após rotação, STOP concorrente e encerramento de aba confirmado produziram o estado esperado. No caso de 80 ms o áudio ficou vazio e a sessão permaneceu parcial; falha de microfone também permaneceu parcial com material decodificável. Os eventos de fim de fonte foram simulados nos streams gerados; não substituem tabCapture, fechamento real de aba ou microfone físico da extensão instalada.

Os testes integrais cobrem adapters de transcrição/notas com SDK real e HTTP interceptado, evidência literal/recuperada, omissões, contratos/migrações e recuperação de jobs/leases. React e bibliotecas de UI conservaram versões e passaram nas renderizações existentes e nas interações no navegador. Nenhuma chamada Gemini autenticada, chave real ou reunião privada foi usada. Não houve revisão estética ou declaração de auditoria visual completa.

As primeiras tentativas do novo harness de navegador confundiram áudio sob demanda com player imediatamente montado e usaram `.click()` sem os eventos de ponteiro necessários às abas Radix. O harness foi corrigido para verificar o estado da aba com eventos reais do navegador; não se alterou código nem teste anterior para acomodar falha. O log inicial preservado não é apresentado como aprovação.

## Arquivos alterados e evidências

Arquivos do projeto alterados/criados neste bloco:

- `package.json`, `package-lock.json`: dois patches diretos e transitivas relacionadas do Vite.
- `tests/external-collection-limits.test.ts`: 11 novas regressões; nenhum teste anterior reescrito.
- `THIRD_PARTY_NOTICES.md`: inventário de runtime regenerado para a versão nova do Zod, mantendo avisos/licenças.
- `README.md`, `docs/STATUS.md`, `docs/BLOCK_7B_AUDIT.md`: status e contagem atualizados; histórico identificado.
- `docs/BLOCK_7B1_DEPENDENCIES.md`: este relatório.

Evidências/harnesses privados em `.verification/block-7b1/`: metadados npm, `lock-review.json`, `checks.json`, `clean-*.log`, auditorias antes/depois, `collection-contrast.json`, `schema-contrast.json`, `vite-entries.json`, `csp-probe.json`, `browser-smoke.json`, `native-audio.json`, `reproducibility.json`, inventários e hashes de preservação. Nenhum desses perfis/logs é candidato ao Git.

Para reproduzir: `npm ci`; typecheck, lint, `npm test`; os quatro comandos de build; `npm run audit:dist`; as duas auditorias npm; `npm run test:idb:edge` no Windows/Edge. Nos harnesses locais, `prepare-browser.mjs` precede `browser-smoke.mjs`; `schema-contrast.mjs`/`collection-contrast.mjs` também usam a instalação antiga isolada do 7B como comparador. Demais comandos e códigos de saída ficam nos logs/checks. O teste do Edge exige o executável no caminho indicado pelo harness e execução permitida pelo ambiente.

## Prontidão e riscos restantes

**Dependências aprovadas para a preparação do primeiro GitHub; B1/B2 encerrados.** Não foi identificada regressão funcional nos ensaios executados. O aviso de depreciação transitiva de `node-domexception` continua sem impedir instalação/build.

A licença ainda depende de decisão do titular. A CI está preparada, mas não foi executada no GitHub; a validação ocorreu em Windows, sem prova de equivalência entre sistemas operacionais. Ainda cabe ensaio final da extensão instalada com material sintético e ciclo real de jobs/upload/delete. Qualidade/custo da Gemini, controle do perfil local, janela de upload órfão e os limites gerais de memória documentados permanecem riscos conhecidos. Distribuição de binários exige incluir avisos de terceiros e futura licença no pacote.

Publicação será decidida separadamente. O trabalho para neste bloco.
