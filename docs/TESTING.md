# Desenvolvimento e testes

Use Node **22.23.2** (`.nvmrc`) e npm **11.1.0**, o ambiente de referência desta preparação. Os intervalos de compatibilidade de `package.json` são mais amplos e não equivalem a ensaios em todas as versões. Nenhuma chave Gemini é necessária para instalar, compilar ou executar os testes automatizados.

## Instalação e verificação

Na raiz de uma cópia limpa do código:

```sh
npm ci --no-audit --fund=false
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:dist
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

No PowerShell, use `npm.cmd` no lugar de `npm`. Instalação/auditoria dependem de acesso ao registro npm; as auditorias não fazem parte da funcionalidade da extensão. Não crie `.env` nem salve chave no código. O build está em `dist`; carregamento descompactado no Edge está descrito no [README](../README.md#carregar-no-microsoft-edge).

O conjunto atual contém **333 testes em 37 arquivos**. Inclui contratos Zod, evidências/recuperação de notas, filas/leases, persistência/migrações, captura/rotação, SDK com HTTP interceptado e renderização dos componentes. Fixtures são sintéticas. Nenhum teste automatizado exige gravações reais ou credenciais do usuário.

## Ferramentas existentes

| Comando | Finalidade / limite |
| --- | --- |
| `npm run dev` | Servidor web em `127.0.0.1`; não substitui a instalação MV3 |
| `npm run dev -- --mode foundation-mock` | Prévias fictícias de sessão/biblioteca/galeria, fora do build de produção |
| `npm run test:watch` | Vitest interativo |
| `npm run build:fixtures` | `dist-dev`, somente simulação |
| `npm run build:chunk-test` | `dist-chunk-test`, alvo de 10s; instalado e acionado, pode usar Gemini e gerar cobrança |
| `npm run build:diagnostic` | `dist-diagnostic`, diagnóstico estrutural de desenvolvimento |
| `npm run test:idb:edge` | Harness de IndexedDB nativo, específico de Windows e caminho local do Edge; perfil isolado em `.verification/` |

Não distribua os três builds de desenvolvimento como pacote da beta. O script de build normal executa typecheck e auditoria estática MV3/CSP; lint e testes são etapas separadas. O npm audit consulta advisories conhecidos, sem provar ausência de todos os riscos.

## CI e validação manual

`.github/workflows/ci.yml` executa instalação pelo lockfile, typecheck, lint, testes, build/MV3 e npm audit numa matriz Windows/Linux. Usa Node da `.nvmrc`, npm fixado, actions oficiais por SHA e permissões `contents:read`. Não recebe chave Gemini nem publica artefatos. Sua execução remota permanece pendente até a criação autorizada do repositório. Dependabot cobre npm e GitHub Actions.

Os ensaios locais no Edge/headless e com áudio sintético estão descritos em [7B.1](BLOCK_7B1_DEPENDENCIES.md); os novos resultados de preparação estão no [7C](BLOCK_7C_PUBLICATION.md). O harness IDB não valida todo o fluxo tabCapture. Antes de distribuir a beta, cabe um ensaio da extensão instalada em perfil separado: concessão de microfone, captura/STOP/fechamento da aba, consulta de fontes, falha/reinício de jobs, limpeza remota e exclusão local, usando material que possa ser enviado à API e considerando eventual cobrança.

Qualidade/custo da Gemini, microfone físico, Narrator e todas as versões do Edge não são cobertos pelos testes unitários. Os [roteiros históricos](TEST_PLAN.md) preservam cenários/evidências por bloco; links para `.verification/` nesses registros são locais e deliberadamente indisponíveis no checkout público.
