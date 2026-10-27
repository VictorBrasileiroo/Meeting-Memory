# Privacidade e dados

## O que sai do dispositivo

Partes de áudio da aba e do microfone são enviadas pelo SDK `@google/genai` à Files API da Gemini; a Interactions API usa esse áudio para transcrever. A transcrição textual é enviada para gerar notas. Não há backend próprio, telemetria de produto ou ferramentas de busca/grounding configuradas no fluxo auditado. Abrir o link do AI Studio é uma navegação externa explícita.

Cada usuário deve conferir acesso, cotas, cobranças e termos do projeto. Grave somente conteúdo que você esteja autorizado a capturar e enviar. Avalie a política aplicável ao seu uso da API antes de enviar dados confidenciais.

## Chave e dados locais

`chrome.storage.local` guarda a chave e preferências no perfil, sem sincronização. `setAccessLevel(TRUSTED_CONTEXTS)` restringe acesso a contextos confiáveis; não criptografa nem protege contra quem controla perfil, DevTools, máquina ou código comprometido da própria extensão. A chave passa internamente ao offscreen e ao worker para uso do SDK. Apagar a chave nas configurações não a revoga no provedor; revogue-a no Google se houver exposição.

O IndexedDB guarda gravações/fragmentos, transcrições, notas, metadados e jobs. Não há criptografia adicional do aplicativo. A biblioteca permite apagar áudio elegível ou reuniões, sem lixeira. Um marcador mínimo de ID/data impede recriação de reunião excluída. Jobs mínimos de limpeza remota podem permanecer até conclusão. Remover a extensão pode apagar dados locais e interromper limpezas remotas pendentes.

## Upload e exclusão

As chamadas Interactions usam `store:false`. A [documentação de retenção da Gemini](https://ai.google.dev/gemini-api/docs/zdr) distingue esse estado de conversa do armazenamento da Files API e das demais políticas de dados. Não é promessa de processamento offline ou retenção zero universal.

Depois do commit local da transcrição, um job separado solicita exclusão remota; HTTP 404 é tratado como arquivo já ausente. Se falhar, há backoff e limite finito de tentativas. Credenciais ausentes/inválidas, perda do executor ou remoção da extensão podem impedir conclusão. Se o upload for aceito e a resposta se perder antes de salvar a identidade remota, a aplicação pode não conhecer o arquivo a excluir. A [Files API](https://ai.google.dev/gemini-api/docs/files) documenta expiração em 48 horas; isso não substitui delete explícito nem descreve toda a política do provedor.

A preferência “Manter gravação local” preserva áudio. Para novas partes finalizadas, a retenção padrão aguarda notas salvas e limpeza remota antes de liberar áudio; falhas/parcialidade preservam material disponível. Áudio removido por políticas anteriores não pode ser restaurado. Exclusão local, exclusão do arquivo remoto e retenção do Google são processos distintos.

## Diagnósticos e compartilhamento

Erros de API usam mensagens fixas e projeção de vocabulário técnico; limitações das notas usam contagens/enums. Não compartilhe perfil do navegador, banco, chave, áudios, transcrições, notas, corpo bruto de resposta ou cabeçalhos de autenticação. Use reprodução sintética ao relatar problemas.

O filtro de diagnóstico reduz exposição; não garante anonimização de qualquer conteúdo possível. Riscos residuais estão no [relatório 7B](BLOCK_7B_AUDIT.md).
