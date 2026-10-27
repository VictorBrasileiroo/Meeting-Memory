# Meeting Memory

Extensão para Microsoft Edge que captura áudio da aba e do microfone, transcreve com a Gemini API e organiza notas com referências à transcrição original.

**Beta em preparação.** Instalação local como extensão descompactada; não publicada na loja do Edge. Os bloqueios de dependências foram encerrados no [Bloco 7B.1](docs/BLOCK_7B1_DEPENDENCIES.md). Consulte a [limpeza final 7C e pendências de publicação](docs/BLOCK_7C_PUBLICATION.md).

## Funcionalidades

- Captura de aba e microfone, independente de manter o popup aberto.
- Partes de áudio WebM com rotação em aproximadamente 29min30s e sobreposição entre partes.
- Transcrição progressiva e geração de notas após encerramento íntegro e transcrições completas.
- Perfis Geral, Pesquisa, Desenvolvimento e Aula; modelos de notas selecionáveis nas configurações.
- Consulta de notas, transcrição original e áudio local disponível; referências literais para conferir as notas.
- Cópia/exportação de notas em Markdown e cópia da transcrição.
- Biblioteca com busca, filtros, medição de armazenamento e exclusão manual individual ou em lote.
- Recuperação do material persistido após falhas e novas tentativas quando elegíveis. A gravação não retoma automaticamente após crash.

## Privacidade e limitações

**Não funciona inteiramente offline.** Áudio é enviado à Gemini para transcrição; texto é enviado para gerar notas. Cada usuário fornece sua chave, sujeita a acesso, cotas e cobrança do próprio projeto Google.

A chave fica em `chrome.storage.local`, sem sincronização e com acesso restrito aos contextos confiáveis da extensão. Esse armazenamento não é um cofre criptografado: quem controla o perfil ou a máquina pode recuperar a chave. Notas, transcrições e áudio retido ficam no IndexedDB do perfil, também sem criptografia implementada pelo aplicativo.

As chamadas Interactions usam `store:false`; isso não significa ausência de toda retenção pelo provedor. A aplicação agenda exclusão do arquivo remoto depois de salvar a transcrição, com tentativas limitadas. Falhas, ausência de chave ou perda da resposta de upload podem deixar arquivos pendentes. Consulte [privacidade](docs/PRIVACY.md).

Notas geradas podem conter omissões e interpretações incorretas. Confira a fonte antes de tomar decisões. Cancelamento do processamento, importação de áudio, lixeira, backup/importação de dados, pastas, renomeação e análise hierárquica de reuniões muito longas **não estão implementados**. Só uma sessão de captura/processamento principal fica ativa por vez. Identificação de falantes não equivale a identificação de pessoas e sua qualidade não é garantida.

## Instalação local

Ambiente de referência desta auditoria: Node.js **22.23.2** (`.nvmrc`) e npm **11.1.0**. Os demais intervalos aceitos constam em `package.json`; não representam validação em todas essas versões.

Na raiz do projeto, no PowerShell:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Em outros shells, use `npm` no lugar de `npm.cmd`. Não há chave necessária para compilar ou executar os testes automatizados. Instale pelo `package-lock.json`; não copie `node_modules` de outra máquina.

### Carregar no Microsoft Edge

1. Abra `edge://extensions` e ative **Modo de desenvolvedor**.
2. Escolha **Carregar sem compactação** e selecione a pasta `dist` produzida pelo build.
3. Abra as configurações da extensão, informe **sua própria chave Gemini** e salve. Obtenha/gerencie a chave no [Google AI Studio](https://aistudio.google.com/api-keys). Não coloque a chave no código, `.env`, issues ou capturas.
4. Escolha o modelo de notas. Os IDs disponíveis estão em `src/domain/analysis-models.ts`; o acesso depende do seu projeto. O modelo fica fixado por sessão, sem fallback automático.
5. Abra a aba a capturar, escolha o perfil no popup e inicie. Se solicitado, conceda acesso ao microfone na página visível e volte à aba para iniciar com novo gesto.
6. Finalize pelo popup. Fechar a aba capturada também encerra a gravação; falhas de fonte podem preservar somente material parcial. Consulte o resultado quando as notas estiverem prontas.

Para atualizar, encerre captura/processamento antes de reconstruir e recarregar a extensão. Preserve o perfil e o IndexedDB. Remover a extensão pode apagar dados locais; exclusão de reuniões e áudio não possui lixeira.

## Desenvolvimento e verificações

| Comando | Uso |
| --- | --- |
| `npm run dev` | Vite em `127.0.0.1`; páginas web, sem validar APIs de extensão/CSP de produção |
| `npm run dev -- --mode foundation-mock` | Prévia fictícia: `/src/session/session.html` ou `/src/design-preview/design-preview.html` |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm run lint` | ESLint sem avisos |
| `npm test` / `npm run test:watch` | Vitest, execução única / modo interativo |
| `npm run build` | Typecheck, produção em `dist` e auditoria estática MV3/CSP |
| `npm run audit:dist` | Auditar um `dist` já construído |
| `npm run build:fixtures` | Simulação em `dist-dev`; não distribuir como produção |
| `npm run build:chunk-test` | Partes de 10s em `dist-chunk-test`; **pode chamar a API e gerar cobrança** |
| `npm run build:diagnostic` | Diagnóstico estrutural em `dist-diagnostic`; somente desenvolvimento |
| `npm run test:idb:edge` | Harness específico de Windows/Edge; resultado e limites no relatório 7C |
| `npm audit` | Consulta de vulnerabilidades no registro npm |

O conjunto atual tem 333 testes automatizados, incluindo os 322 anteriores e 11 regressões de limites de coleções. Testes com SDK usam transporte interceptado e credenciais fictícias; esse resultado não valida qualidade, custo nem todos os eventos reais do Edge. A CI proposta verifica código e build sem chave Gemini e sem publicar artefatos. Consulte [desenvolvimento e testes](docs/TESTING.md) para o roteiro completo e seus limites.

## Tecnologias e arquitetura

TypeScript, React, Vite, Tailwind CSS, componentes locais no padrão shadcn/ui com Radix, Lucide React, Zod e `@google/genai`. Fontes Bricolage Grotesque e Source Serif 4 empacotadas localmente.

```text
popup / settings / session / library
                  │ mensagens validadas
          background service worker
                  │ coordenação
        offscreen: captura e gravação
                  │ worker local: fila e Gemini
                  └── IndexedDB: partes, transcrições, notas e jobs
```

O Manifest V3 limita rede à Gemini e empacota scripts, estilos, fontes e worker localmente. O IndexedDB v5 usa migrações aditivas, transações, leases/generations e marcadores de exclusão para recusar commits atrasados. Consulte a [arquitetura atual](docs/ARCHITECTURE_CURRENT.md), o [estado atual](docs/STATUS.md) e o [índice da documentação](docs/README.md), que separa instruções atuais de decisões e relatórios históricos.

## Licença e publicação

Licenciado sob a [MIT](LICENSE), escolhida pelo titular no Bloco 7C. Fontes e dependências mantêm suas próprias licenças; veja [escopo da licença](docs/LICENSING.md) e [avisos de terceiros](THIRD_PARTY_NOTICES.md).

Versão beta proposta: tag `v0.1.0-beta.1`, seguida de `beta.2` etc. O manifest permanece `0.1.0` até decisão de release. Nenhum repositório remoto, release ou publicação na loja foi criado nesta etapa.
