# Documentação do Meeting Memory

Comece pelo [README do projeto](../README.md). A ordem de leitura abaixo separa instruções atuais de registros de implementação. Documentos históricos conservam propostas, decisões substituídas, contagens de testes da época e evidências locais; não representam sozinhos o estado da beta.

## Documentação atual

| Documento | Conteúdo |
| --- | --- |
| [Estado atual](STATUS.md) | Funcionalidades entregues e limites da beta |
| [Arquitetura atual](ARCHITECTURE_CURRENT.md) | Componentes, fronteiras de confiança, persistência e processamento |
| [Desenvolvimento e testes](TESTING.md) | Instalação, comandos reproduzíveis e limites da validação |
| [Privacidade](PRIVACY.md) | Chave, dados locais, envio à Gemini e exclusão remota |
| [Licença MIT](LICENSING.md) | Decisão do titular, atribuição e escopo; texto integral em LICENSE |
| [Avisos de terceiros](../THIRD_PARTY_NOTICES.md) | Licenças das dependências; não substituem a licença do projeto |
| [Sistema de design](DESIGN_SYSTEM.md) | Direção vigente Áudio × Papel; as seções antigas estão contextualizadas no próprio documento |
| [Fontes locais e OFL](UI_LICENSES.md) | Assets empacotados e licenças |
| [Conteúdo proposto para o primeiro commit](FIRST_COMMIT_CONTENTS.md) | Lista exata dos caminhos candidatos, sem staging ou commit |
| [Limpeza final 7C](BLOCK_7C_PUBLICATION.md) | Resultado mais recente, verificações e pendências antes de publicar |

## Decisões e histórico técnico

Estes arquivos são preservados como memória de engenharia. Leia os registros mais recentes antes de interpretar uma proposta antiga como comportamento atual.

| Documento | Papel histórico |
| --- | --- |
| [Decisões arquiteturais](DECISIONS.md) | Registro evolutivo; decisões posteriores podem substituir anteriores |
| [Evolução da arquitetura](ARCHITECTURE.md) | Propostas e entregas dos blocos, com contexto de migrações e contratos |
| [Especificação original](PRODUCT_SPEC.md) | Requisitos e recortes anteriores; o estado atual prevalece |
| [Plano de testes e evidências](TEST_PLAN.md) | Roteiros manuais, resultados e limitações por bloco |
| [Plano 6A](BLOCK_6A_PLAN.md) | Planejamento de interface e escopo autorizado posteriormente |
| [Fundação 6B.1](BLOCK_6B1_FOUNDATION.md) | Introdução dos componentes/tokens locais |
| [Resultados 6B.2](BLOCK_6B2_RESULTS.md) | Leitura, fontes, histórico e validação de resultados |
| [Refinamento 6B.3](BLOCK_6B3_UI_REFINEMENT.md) | Direção Áudio × Papel e limites dos ensaios CSP |
| [Reuniões e armazenamento](MEETING_MANAGEMENT.md) | Biblioteca, limpeza manual, migração v5 e proteção contra recriação |
| [Bloco 7A](BLOCK_7A_RESULTS.md) | Recuperação de notas e encerramento ao fechar a aba |
| [Auditoria 7B](BLOCK_7B_AUDIT.md) | Achados iniciais e atualizações de encerramento dos bloqueios |
| [Correções 7B.1](BLOCK_7B1_DEPENDENCIES.md) | Patches Zod/Vite e regressão de segurança |
| [Processo de design](DESIGN_PROCESS.md) | Procedência das skills e revisões realizadas |
| [Redesign de 18/10](RESULTS_REDESIGN_2026-10-18.md) | Composição e evidência daquela entrega |
| [Revisão de 18/10](DESIGN_REVIEW_2026-10-18.md) | Achados de interface da época, sem certificação global |
| [Protótipo estático 6A](previews/meeting-memory-6a.html) | Experimento histórico, fora dos entrypoints Vite e do pacote da extensão |

## Evidência privada

Referências históricas a `.verification/` apontam para harnesses, capturas, perfis e logs locais deliberadamente excluídos do repositório público. Esses links antigos não são documentação necessária para instalar, testar ou compilar. Não copie esse diretório para “consertar” links no GitHub. Os testes distribuídos ficam em `tests/` e `scripts/`; os comandos atuais estão em [TESTING.md](TESTING.md).

Nenhum documento histórico foi apagado ou movido nesta organização. Isso preserva referências existentes e decisões importantes sem apresentar toda a cronologia como manual de uso atual.
