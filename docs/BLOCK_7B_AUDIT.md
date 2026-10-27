# Bloco 7B — auditoria pré-publicação

27/10/2026 · Windows · Node 22.23.2 · npm 11.1.0 · candidato beta.

> Atualização 7C: o titular escolheu MIT; a licença foi aplicada em `LICENSE` e nos metadados do pacote. A preparação mais recente está em [BLOCK_7C_PUBLICATION.md](BLOCK_7C_PUBLICATION.md). As pendências de licença e contagens do texto histórico abaixo descrevem as etapas anteriores.

## 1. Parecer

**Atualização 7B.1 (27/10/2026): bloqueios de dependências encerrados.** Zod 4.6.7 e Vite 8.3.5 passaram na regressão de 333 testes, instalação limpa, builds e consultas npm completa/de produção com zero vulnerabilidades. [Relatório de correção e evidências](BLOCK_7B1_DEPENDENCIES.md). A licença precisa da decisão do titular; execução remota da CI, ensaio final de instalação e autorização de publicação continuam pendentes.

As contagens, versões e ensaios das seções históricas abaixo descrevem a auditoria original 7B, salvo atualização explícita. Os resultados atuais e os arquivos alterados estão no relatório 7B.1.

Não houve push, criação de repositório remoto, commit, tag, release ou publicação na loja. O workspace continua sem Git na raiz. Um diretório Git descartável, sem commit/remoto, foi usado **somente dentro de `.verification/block-7b/`** para aplicar as regras de ignore à lista candidata.

Preservação por SHA-256: **159 arquivos funcionais/de testes/configuração anteriores conferidos, zero alterados e zero acrescentados nesse conjunto**. Inclui `src/`, `tests/`, `public/`, `scripts/`, package/lockfile e configurações de build. Alterações desta etapa se limitam à documentação, `.gitignore` e configurações de GitHub; harnesses/evidências ficam em `.verification/block-7b/`. Nenhuma interface foi alterada, portanto não houve redesign ou novo ciclo de revisão visual.

## 2. Achados e severidade

“Bloqueante” indica o gate recomendado desta auditoria antes de tornar o candidato público; não significa que um ataque tenha sido observado. Severidade do advisory e exposição neste produto são descritas separadamente.

| ID | Classificação | Arquivo/área e achado | Medida / estado |
| --- | --- | --- | --- |
| B1 | **Encerrado no 7B.1** | Zod 4.6.5 → 4.6.7; GHSA-mrhx-c7xc-m3w5 | Auditorias zeradas, limites existentes preservados e regressão de rejeição antecipada de coleções excessivas aprovada |
| B2 | **Encerrado no 7B.1** | Vite 8.3.2 → 8.3.5; seis advisories anteriores | Auditorias zeradas; entradas, quatro builds, importações e regressão no navegador aprovados; sem audit fix/force |
| B3 | **Bloqueante — corrigido na preparação** | `.gitignore`: cache npm e `tests.zip` entrariam no primeiro commit; cache somava centenas de arquivos | Exclusões ampliadas; nenhum cache, ZIP, perfil ou build entra na lista candidata final |
| I1 | **Importante — decisão do titular** | Ausência de `LICENSE` e de licença declarada do projeto | Opções em [LICENSING.md](LICENSING.md). Não anunciar “open source” até definir os termos. Publicar sem licença é tecnicamente possível, mas não concede as permissões usuais de reutilização |
| I2 | **Importante — preparado** | README antigo contradizia entregas atuais; docs continham caminhos pessoais locais | README refeito, caminhos removidos das docs públicas e avisos de precedência nos documentos históricos. `AGENTS.md` local excluído da publicação, preservado no workspace |
| I3 | **Importante — preparado, execução remota pendente** | CI e monitoramento de dependências preparados no 7B | Os comandos locais de auditoria passaram no 7B.1; execução da matriz no GitHub continua pendente |
| I4 | **Importante — documentado** | Chave em `chrome.storage.local`; dados em IndexedDB sem criptografia adicional do aplicativo | Acesso confiável já implementado; limites agora explícitos no README e em [PRIVACY.md](PRIVACY.md). Não apresentar como cofre |
| I5 | **Importante — limite existente** | Limpeza remota pode ficar pendente ou sem identidade de arquivo após perda da resposta de upload | Não prometer exclusão imediata/garantida. Repetir roteiro nativo de falha/restart/credenciais antes da beta; nenhuma mudança de fluxo nesta etapa |
| I6 | **Importante — preparação parcial para binários** | Só licenças das fontes entram hoje em `dist/licenses/`; aviso completo de bibliotecas não é copiado pelo build | `THIRD_PARTY_NOTICES.md` preparado para o repositório. Incluir esse aviso e a futura licença no pacote antes de distribuir ZIP/CRX; não modificar o pipeline nesta auditoria |
| F1 | **Melhoria futura** | `scripts/audit-dist.mjs`: regex de eval cobre nomes literais, mas não aliases como `const F = Function; new F(...)` | Complementar com análise sintática e ensaio CSP de runtime. O “PASS” atual é auditoria estática limitada |
| F2 | **Melhoria futura** | `service-worker.ts`, `offscreen.ts` e telas reaproveitam algumas `Error.message` de falhas locais | Preferir catálogo de mensagens por código numa alteração focada. Transporte Gemini já projeta erros em mensagens seguras; não foi identificado vazamento concreto por esses caminhos |
| F3 | **Melhoria futura** | `analysis-diagnostic.ts`: vocabulário técnico pode preservar palavras que também apareçam em conteúdo pessoal | Tratar como redução de exposição, não anonimização formal; considerar somente códigos/contagens para diagnóstico compartilhável |
| F4 | **Melhoria futura** | Roteiros históricos dependem de harnesses locais; teste Edge fixa caminho Windows e transpila trechos | Publicar harness independente em trabalho posterior. Não exigir esse script na CI Linux; manter testes anteriores intactos |

### Dependências: risco real

Consulta online ao npm: **2 pacotes afetados, ambos com maior severidade alta; zero críticos**. Consulta `--omit=dev`: **1 alto (Zod)**. A contagem de pacotes não é a contagem de advisories.

Zod valida respostas externas de notas e contratos locais. O limite de saída do modelo e os `.max()` dos schemas reduzem os volumes esperados; não bastam para declarar o advisory inaplicável. O risco predominante é disponibilidade/memória, sem evidência de execução remota ou extração da chave. A versão mínima corrigida publicada é 4.6.6; a consulta npm sugeriu 4.6.7. [Advisory Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

Vite é ferramenta de desenvolvimento, não é servidor embarcado em `dist`. Seus alertas incluem abertura de editor/injeção de comando no Windows e exposição de arquivos no servidor de desenvolvimento. O bind em `127.0.0.1` reduz exposição, sem justificar manter a versão conhecida como vulnerável. Isso **não implica que a extensão instalada exponha esses endpoints**. [Advisory Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [escape de argumentos](https://github.com/advisories/GHSA-698v-4r3x-3vcv). Os demais URLs/ranges e a sugestão 8.3.5 estão no JSON local da consulta; devem ser reconsultados ao corrigir.

Todos os **11 pacotes de runtime declarados têm importações no projeto**. Ferramentas de build/lint/testes e pacotes `@types` têm função identificada; não foi identificada dependência direta obviamente desnecessária. Não houve remoção ou atualização por preferência arquitetural. Versões diretas fixas, lockfile com integridades e URLs do registro público preservados. O aviso de depreciação transitiva `node-domexception` não impediu a instalação; considerar sua remoção por atualização futura do SDK, com regressão.

## 3. Investigação específica: Zod e eval

**A sondagem CSP não é bloqueante por si só. Não relaxar a CSP.** É diferente do advisory de memória B1.

No Zod 4.6.5 oficial, `v4/core/util.js` testa capacidade de geração dinâmica por `const F = Function; new F("")`, dentro de `try/catch`. Sob `script-src 'self'`, o navegador recusa a execução; o catch retorna `false`, e o parser usa o interpretador. Um evento de violação/aviso pode existir mesmo com a exceção capturada. A tentativa é de código constante da biblioteca, não de executar texto da reunião.

`src/lib/ui-csp.ts` já define `z.config({jitless:true})` no bootstrap visual. `vite.config.ts` separa Zod dos schemas da aplicação para preservar essa ordem. Service worker, offscreen e worker de fila não importam esse bootstrap; portanto não afirmar que todos os contextos deixam de sondar eval.

Ensaio novo com **Edge 156.0.4314.42**, perfil descartável e CSP copiada integralmente do manifest, sem APIs autenticadas:

| Contexto sintético | Entrada válida aceita | Entrada inválida rejeitada | Eventos de eval |
| --- | --- | --- | --- |
| Página / Zod padrão | Sim | Sim | 1 bloqueado |
| Worker / Zod padrão | Sim | Sim | 1 bloqueado |
| Página / jitless antes dos schemas | Sim | Sim | 0 |
| Worker / jitless antes dos schemas | Sim | Sim | 0 |

Evidência: `csp-probe.mjs`, `csp-probe.json` e log em `.verification/block-7b/`. O ensaio testa a biblioteca em página/worker HTTP com a mesma CSP, **não substitui instalação MV3 nem prova ausência de todos os eventos em todas as telas**. Os relatórios anteriores preservam seus eventos conhecidos. As 11 dependências diretas de runtime foram comparadas recursivamente com a instalação limpa: zero diferenças. A investigação não encontrou patch local oculto do Zod.

A regex de `audit-dist` não vê o alias `F`; portanto seu resultado não autoriza a frase “bundle sem qualquer tentativa de eval”. Uma eventual redução de avisos deve usar configuração suportada antes dos schemas, com teste de ordem em todos os contextos, sem editar `node_modules` e sem `unsafe-eval`. A [CSP do MV3](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) é mantida.

## 4. Segurança, privacidade e persistência

- **Conjunto público:** inspeção de fixtures, imports, configuração, manifest, documentação e varredura de padrões para chaves Google, tokens GitHub/OpenAI, JWTs, chaves privadas, URLs com credenciais e caminhos pessoais. Nenhum segredo de alta confiança nem arquivo de áudio real foi identificado no conjunto candidato. Strings de chave nos testes são marcadores fictícios. Varredura por padrões não prova ausência de todo segredo possível.
- **Dados locais:** `.verification/` contém perfis e evidências, inclusive arquivos de terceiros com strings semelhantes a chaves. Não inferir que sejam a chave Gemini do usuário nem copiar seus valores. A exclusão integral evita publicar esse material. Cache npm e ZIP local foram mantidos no disco e excluídos; não foi necessário abrir/escutar gravações ou bancos pessoais. A varredura adicional de artefatos textuais, excluindo perfis/caches/dependências, não encontrou padrões de chave; não certifica os bancos binários privados.
- **Chave:** `settings.ts` limita formato e tamanho, usa `chrome.storage.local`, tenta `TRUSTED_CONTEXTS` e recusa salvar se a restrição falhar. Não usa `storage.sync`. O background restringe a resposta de credencial ao URL exato do offscreen da mesma extensão. A chave passa ao worker em memória e não faz parte do snapshot. A [API storage](https://developer.chrome.com/docs/extensions/reference/api/storage) restringe contextos, não oferece um cofre contra controle do perfil/máquina.
- **Permissões:** `storage` para chave/estado; `activeTab` para o alvo acionado pelo usuário; `tabCapture` para áudio da aba; `offscreen` para captura/processamento fora do popup. Host somente `https://generativelanguage.googleapis.com/*`. Não há `<all_urls>`, content scripts, `externally_connectable`, `tabs` ou `unlimitedStorage`. Acesso ao microfone depende da concessão do navegador.
- **CSP/código remoto:** scripts, fontes, estilos e worker empacotados; `script-src 'self'`, sem `unsafe-inline`/`unsafe-eval`; conexões restritas à Gemini. O build normal exclui fixtures, diagnóstico e controles de teste. Links informativos e strings inertes dos SDKs não são, sozinhos, execução remota. Nenhum carregamento intencional de código remoto foi identificado no fluxo auditado.
- **Erros/modelo:** classificadores de Gemini usam mensagens fixas e códigos permitidos; diagnóstico 400 usa projeção de vocabulário e limites. Relatórios de omissão das notas guardam enums/contagens, não citações. Textos são renderizados por React, sem HTML arbitrário do modelo. Validação lexical de evidência não prova toda a semântica das notas.
- **Upload/delete:** identidade confirmada é salva antes da transcrição; commit da transcrição cria job de delete na mesma transação. Erro de limpeza não apaga a transcrição. HTTP 404 de delete é aceito como ausente; backoff/limite/espera por credenciais são duráveis. Exclusão local preserva identidades conhecidas e jobs mínimos de limpeza. Upload aceito com resposta perdida continua janela de órfão não identificável. A [Files API](https://ai.google.dev/gemini-api/docs/files) documenta expiração de 48h. `store:false` não elimina armazenamento da Files API nem todas as políticas de retenção; ver [documentação de retenção](https://ai.google.dev/gemini-api/docs/zdr).
- **IndexedDB/recuperação:** versão 5 com stores/índices aditivos e fechamento em `versionchange`; leases/generations rejeitam commits atrasados; marcadores impedem recriação de conteúdo excluído. Notas/diagnóstico/conclusão são commitados atomicamente; fragmentos e material parcial são preservados quando aplicável. Recuperação não recria áudio perdido nem retoma stream após crash. Quota/remoção do perfil continuam riscos sem backup implementado.

## 5. Verificações e reprodução

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado no workspace e cópia limpa |
| `npm run lint` | Aprovado em ambos |
| `npm test` | **322 testes / 36 arquivos**, aprovados em ambos |
| `npm run build` | Aprovado em ambos; auditoria estática de 8 entrypoints / 42 artefatos de código |
| Arquivos completos de `dist` | **50 arquivos** com hashes idênticos entre workspace e cópia limpa, incluindo assets/licenças |
| `npm ci` em diretório isolado | Aprovado, 228 pacotes instalados; não copiou `node_modules` original |
| `npm audit` / `--omit=dev` | Reprovação esperada: 2 altos / 1 alto |
| `npm run test:idb:edge` | Primeira tentativa falhou por processo gráfico no sandbox; repetição isolada fora dessa restrição **aprovada** |
| Ensaio Zod/CSP | Aprovado quanto ao fallback; eventos conhecidos registrados, não descartados |
| GitHub Actions | YAML/pins revisados localmente; **não executado no GitHub** |

A cópia limpa foi montada pelos caminhos candidatos que o Git enumerou com `.gitignore`, sem perfil, cache ou builds, dentro de `.verification/block-7b/clean-source`. Foi executado `npm ci --no-audit --fund=false`, seguido de typecheck, lint, testes e build. O cache offline inicial estava incompleto (ENOTCACHED); a instalação online subsequente passou, preservando o lockfile. Usar cache como transporte não equivale a copiar uma instalação pré-existente: integridades são verificadas pelo npm.

Isso comprova reprodução neste Windows/Node/npm/arquitetura. Ainda não comprova byte a byte entre sistemas operacionais, outras versões de Node/npm, nem um clone real, pois não há commit/remoto. A matriz CI proposta cobre Windows/Linux, pendente de execução futura. Nenhuma chamada Gemini autenticada ou leitura de reuniões reais foi usada como teste.

Evidências locais: `functional-before.json`, `preservation.json`, `candidates-before.txt`, `candidates.txt`, `source-scan*.json`, `local-scan.json`, `copy-manifest.json`, `reproducibility.json`, `dependencies.json`, `license-review.json`, logs `clean-*`, `audit-online.json`, `audit-production.json`, `idb-edge-elevated.log`, `csp-probe.json`. Scripts de reprodução ficam no mesmo diretório; esse material inteiro é privado e ignorado.

## 6. Primeiro commit: conteúdo proposto

Enumeração final: **184 arquivos, aproximadamente 2 MB**, incluindo esta preparação; os 151 arquivos existentes de `src/tests/public/scripts` estão presentes. Nenhum achado nos padrões de segredo/caminho pessoal verificados. A lista completa e os hashes ficam na evidência local; reenumerar após corrigir dependências/licença ou acrescentar qualquer arquivo.

Estrutura preparada:

```text
README.md
THIRD_PARTY_NOTICES.md
.gitignore / .nvmrc
.github/workflows/ci.yml
.github/dependabot.yml
package.json / package-lock.json / configurações de build e lint
src/       código, estilos, fontes locais e fixtures de desenvolvimento
public/    manifest e licenças OFL
tests/     testes e fixtures sintéticas
scripts/   auditoria de dist e harness IDB existente
docs/      estado atual, privacidade, licença, auditoria e histórico
LICENSE    a criar após decisão do titular
```

**Entram:** fontes locais WOFF2/OFL, código e testes sintéticos, lockfile, docs sanitizadas e CI. Fixtures em código são necessárias aos testes/prévias e não entram no build normal. O README distingue beta, uso da Gemini, limites, Edge descompactado e recursos não implementados.

**Não entram:** `.verification/` integral (perfis/bancos/capturas/harnesses/logs locais), `.npm-cache/`, `node_modules/`, `dist*`, `tests.zip` ou outros pacotes, `.env*` salvo eventual exemplo sem credencial, `.npmrc`, chaves/certificados, mídia, bancos, exports, temporários e instruções locais `AGENTS.md`. Exclusões não apagam arquivos. Não usar `git add -f` para contorná-las. O `.gitignore` é uma barreira de nomes, não detector universal de conteúdo privado.

Os relatórios históricos permanecem, com contexto de precedência e caminhos pessoais removidos onde encontrados. Links históricos para `.verification/` ficam documentados como evidência local indisponível no checkout público; consolidar/publicar harnesses seguros é trabalho futuro. Não publicar capturas antigas sem uma revisão separada de dados.

### README, licença, CI e versão

README implementado como proposta revisável. Licença: escolha pendente entre MIT (sugestão permissiva simples), Apache-2.0 e GPL-3.0. Avisos de terceiros foram agregados a partir de 83 dependências de produção do lockfile, mais shadcn/ui e referências OFL; isso não substitui decisão de licença do projeto nem revisão de um futuro pacote binário.

CI proposta: `push`, `pull_request` e execução manual; permissões somente `contents:read`, checkout sem persistir credenciais, actions oficiais fixadas em SHA conferido por consulta de tags públicas, Node de `.nvmrc`, npm 11.1.0, `npm ci`, typecheck, lint, testes, build/MV3 e audit com gate alto. Sem chave Gemini, deploy, upload de evidências privadas ou criação de releases. Dependabot monitora npm e actions. Não foi adicionado bypass para os alertas atuais. Revisão estrutural local e checagens de campos/pins realizadas; não houve parser completo de Actions nem execução em runner remoto, portanto sua aprovação final depende da primeira execução no GitHub.

Versão sugerida: pacote `0.1.0-beta.1` na preparação de release, tag futura `v0.1.0-beta.1`; manifest numérico `0.1.0`, com `version_name` opcional apenas se aprovado depois. O estado atual `0.1.0` foi preservado. `private:true` protege contra publicação acidental no npm, sem impedir repositório público. Incrementar a sequência beta e manter changelog de correções/limites; só retirar o sufixo ao encerrar os gates da beta.

## 7. Checklist antes de criar o repositório público

- [x] Corrigir B1/B2 em trabalho controlado, manter a CSP e executar novamente regressão, build limpo, CSP e `npm audit` — concluído no Bloco 7B.1.
- [ ] Escolher licença/titular; criar `LICENSE` integral e alinhar metadados/README.
- [ ] Rever este parecer e confirmar quais limitações serão aceitas e anunciadas na beta.
- [ ] Executar roteiro manual com reunião sintética: captura/STOP/fechamento real de aba, retomada de jobs após reinício, credenciais e delete remoto. Confirmar notas, fonte, áudio e exclusão local. Não usar reunião privada como evidência pública.
- [ ] Reenumerar candidatos e revisar conteúdo; nenhuma chave, mídia, export, perfil ou cache. Confirmar que todos os arquivos de `src/tests/public/scripts` previstos estão incluídos.
- [ ] Após eventual `git init`, conferir `git status --short --untracked-files=all`, `git add --dry-run .`, depois `git diff --cached --stat` e `git diff --cached` **antes do commit**. Não há commit preparado agora.
- [ ] Confirmar identidade/e-mail público do autor e nome/descrição do repositório, sem reutilizar caminhos privados do workspace.
- [ ] Obter aprovação explícita para criar o remoto e publicar. Criar inicialmente sem release automático; verificar secret scanning/push protection disponíveis e alertas de dependências.
- [ ] Exigir CI verde em Windows/Linux, revisar branch protection e só então avaliar tag beta/release.
- [ ] Se distribuir binários depois: construir do código aprovado, incluir licenças/avisos, auditar o pacote e aprovar a publicação separadamente. Não usar `dist-dev`, `dist-chunk-test` ou `dist-diagnostic` como beta de produção.

A auditoria 7B e a correção 7B.1 estão concluídas. As dependências não bloqueiam mais a preparação; as decisões e verificações restantes do checklist e qualquer publicação aguardam avaliação separada.
