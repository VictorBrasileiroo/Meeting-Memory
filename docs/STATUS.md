# Estado atual — candidato à primeira beta

27/10/2026. Este documento e o README prevalecem sobre descrições históricas de escopo nos relatórios dos blocos.

Blocos 1–7A implementados: captura de aba/microfone, rotação, fila durável, transcrição progressiva, notas por perfil com evidência, consulta/cópia/exportação, biblioteca e gerenciamento de armazenamento. O Bloco 7A melhorou recuperação de itens válidos nas notas e encerramento automático ao fechar a aba. IndexedDB v5, sem migração destrutiva.

O usuário relatou uso real do fluxo principal. Nesta auditoria não foram lidas reuniões reais nem usadas chaves/API Gemini autenticada. Os 333 testes automatizados atuais não substituem a validação nativa de tabCapture, reinício completo, áudio, qualidade do modelo, custo, Narrator ou todas as versões de Edge.

Não implementados: cancelamento, importação de áudio, backup/importação de dados, lixeira, pastas, renomeação, processamento hierárquico e múltiplas sessões simultâneas. Recuperar material persistido não significa retomar o stream de uma gravação interrompida.

Documentos antigos preservam decisões e evidências da época. Links para `.verification/` referem-se a evidência local excluída do repositório público. Testes distribuídos ficam em `tests/` e `scripts/`; harnesses históricos e perfis não fazem parte da distribuição.

Bloco 7B.1 concluído: Zod 4.6.7 e Vite 8.3.5; os bloqueios de dependências da [auditoria 7B](BLOCK_7B_AUDIT.md) foram encerrados. O Bloco 7C confirmou 333 testes e auditorias npm completa/de produção sem vulnerabilidades, removeu um componente comprovadamente sem uso e organizou a leitura da documentação. O titular escolheu MIT, aplicada em [LICENSE](../LICENSE). Veja a [lista do primeiro commit](FIRST_COMMIT_CONTENTS.md) e o [parecer final 7C](BLOCK_7C_PUBLICATION.md). Execução remota da CI, ensaio final de instalação para distribuição e autorização de publicação continuam pendentes. Nenhuma publicação ou inicialização de Git foi feita neste bloco.
