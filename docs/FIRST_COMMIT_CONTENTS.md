# Conteúdo proposto para o primeiro commit

27/10/2026 · Bloco 7C · **191 arquivos candidatos**. Esta é uma lista de caminhos relativos, não um staging ou commit. Nenhum Git foi inicializado nesta etapa. Regenerar/revisar se qualquer arquivo for acrescentado, removido ou alterado antes da publicação.

| Grupo | Arquivos |
| --- | ---: |
| .github | 2 |
| raiz | 12 |
| docs | 26 |
| public | 3 |
| scripts | 2 |
| src | 106 |
| tests | 40 |

A licença MIT foi escolhida pelo titular e está em `LICENSE`. Código, testes, fixtures sintéticas, fontes locais/licenças, documentação e CI integram o conjunto. Os nomes fictícios das fixtures e avisos de copyright de terceiros são intencionais.

Não entram `.verification/`, perfis de navegador, `.npm-cache/`, `node_modules/`, `dist*`, logs, dumps, credenciais, mídia, exportações ou instruções locais `AGENTS.md`. O componente sem referências `src/components/RecordingStatus.tsx` foi removido; a comprovação e os hashes ficam na evidência local. Testes e prévias utilizados permanecem.

As regras foram aplicadas com semântica gitignore, sem criar repositório. Os hashes e tamanhos do conjunto final estão em `.verification/block-7c/candidate-manifest.json`, fora da publicação; não se incluem hashes deste próprio documento para evitar autorreferência. O [relatório final](BLOCK_7C_PUBLICATION.md) descreve verificações e pendências.

## Lista completa

```text
.github/dependabot.yml
.github/workflows/ci.yml
.gitignore
.nvmrc
LICENSE
README.md
THIRD_PARTY_NOTICES.md
components.json
docs/ARCHITECTURE.md
docs/ARCHITECTURE_CURRENT.md
docs/BLOCK_6A_PLAN.md
docs/BLOCK_6B1_FOUNDATION.md
docs/BLOCK_6B2_RESULTS.md
docs/BLOCK_6B3_UI_REFINEMENT.md
docs/BLOCK_7A_RESULTS.md
docs/BLOCK_7B1_DEPENDENCIES.md
docs/BLOCK_7B_AUDIT.md
docs/BLOCK_7C_PUBLICATION.md
docs/DECISIONS.md
docs/DESIGN_PROCESS.md
docs/DESIGN_REVIEW_2026-10-18.md
docs/DESIGN_SYSTEM.md
docs/FIRST_COMMIT_CONTENTS.md
docs/LICENSING.md
docs/MEETING_MANAGEMENT.md
docs/PRIVACY.md
docs/PRODUCT_SPEC.md
docs/README.md
docs/RESULTS_REDESIGN_2026-10-18.md
docs/STATUS.md
docs/TESTING.md
docs/TEST_PLAN.md
docs/UI_LICENSES.md
docs/previews/meeting-memory-6a.html
eslint.config.js
package-lock.json
package.json
public/licenses/Bricolage-OFL.txt
public/licenses/SourceSerif-OFL.txt
public/manifest.json
scripts/audit-dist.mjs
scripts/test-idb-edge.mjs
src/assets/fonts/Bricolage-OFL.txt
src/assets/fonts/SourceSerif-OFL.txt
src/assets/fonts/bricolage-normal-latin-ext.woff2
src/assets/fonts/bricolage-normal-latin.woff2
src/assets/fonts/source-serif-italic-latin-ext.woff2
src/assets/fonts/source-serif-italic-latin.woff2
src/assets/fonts/source-serif-normal-latin-ext.woff2
src/assets/fonts/source-serif-normal-latin.woff2
src/background/capture-coordinator.ts
src/background/foundation.ts
src/background/meeting-management.ts
src/background/service-worker.ts
src/capture/browser-media.ts
src/capture/capture-session.ts
src/capture/chunk-config.ts
src/capture/rotating-recorder.ts
src/components/Brand.tsx
src/components/FoundationNotice.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/native-select.tsx
src/components/ui/tabs.tsx
src/components/useSnapshot.ts
src/design-preview/design-preview.html
src/design-preview/main.tsx
src/domain/analysis-diagnostic.ts
src/domain/analysis-input.ts
src/domain/analysis-models.ts
src/domain/analysis-probe.ts
src/domain/capture-integrity.ts
src/domain/contracts.ts
src/domain/note-evidence.ts
src/domain/notes-recovery.ts
src/domain/notes-validation.ts
src/domain/notes.ts
src/domain/profiles.ts
src/domain/recording-state.ts
src/env.d.ts
src/gemini/analysis.ts
src/gemini/speaker-turns.ts
src/gemini/transcription-diagnostics.ts
src/gemini/transcription.ts
src/lib/ui-csp.ts
src/lib/utils.ts
src/library/LibraryApp.tsx
src/library/library-fixtures.ts
src/library/library-model.ts
src/library/library-source.ts
src/library/library.css
src/library/library.html
src/library/main.tsx
src/messaging/client.ts
src/messaging/management-client.ts
src/messaging/management-protocol.ts
src/messaging/protocol.ts
src/microphone/microphone.html
src/microphone/microphone.ts
src/offscreen/offscreen.html
src/offscreen/offscreen.ts
src/popup/AudioWaveform.tsx
src/popup/PopupApp.tsx
src/popup/main.tsx
src/popup/popup-entry.css
src/popup/popup.css
src/popup/popup.html
src/popup/presentation.css
src/queue/job-policy.ts
src/queue/lease-heartbeat.ts
src/queue/local-worker.ts
src/queue/transcription-rate-limit.ts
src/review/review.html
src/review/review.ts
src/session/AnalysisFailure.tsx
src/session/AudioParts.tsx
src/session/MeetingSwitcher.tsx
src/session/NotesContent.tsx
src/session/OriginalTranscript.tsx
src/session/SessionApp.tsx
src/session/SessionContent.tsx
src/session/SessionResult.tsx
src/session/TranscriptPart.tsx
src/session/fixtures.ts
src/session/main.tsx
src/session/meeting-choices.ts
src/session/notes-export.ts
src/session/result-fixtures.ts
src/session/results.css
src/session/session-data.ts
src/session/session-location.ts
src/session/session.html
src/session/useSessionData.ts
src/settings/SettingsApp.tsx
src/settings/main.tsx
src/settings/settings.css
src/settings/settings.html
src/storage/meeting-events.ts
src/storage/meeting-management.ts
src/storage/recordings.ts
src/storage/settings.ts
src/styles/fonts.css
src/styles/foundation.css
src/styles/global.css
src/styles/legacy.css
src/styles/tokens.css
tests/analysis-browser-wire.test.ts
tests/analysis-contract.test.ts
tests/analysis-http-diagnostic.test.ts
tests/analysis-lifecycle.test.ts
tests/analysis-pipeline.test.ts
tests/analysis-probe.test.ts
tests/capture-auto-stop.test.ts
tests/capture-coordinator.test.ts
tests/capture-session.test.ts
tests/capture-tab-events.test.ts
tests/contracts.test.ts
tests/diarization.test.tsx
tests/external-collection-limits.test.ts
tests/fixtures/notes.ts
tests/fixtures/recording.ts
tests/fixtures/transcription-response.ts
tests/foundation.test.ts
tests/gemini-adapter.test.ts
tests/gemini-retry.test.ts
tests/gemini-sdk-wire.test.ts
tests/job-policy.test.ts
tests/library-model.test.ts
tests/local-worker.test.ts
tests/management-background.test.ts
tests/management-protocol.test.ts
tests/meeting-choices.test.ts
tests/meeting-management.test.ts
tests/notes-presentation.test.tsx
tests/notes-recovery-presentation.test.tsx
tests/notes-recovery.test.ts
tests/popup-render.test.tsx
tests/recording-state.test.ts
tests/rotating-recorder.test.ts
tests/service-worker.test.ts
tests/session-render.test.tsx
tests/session-results.test.tsx
tests/settings.test.ts
tests/transcription-pipeline.test.ts
tests/transcription-rate-limit.test.ts
tests/ui-foundation.test.tsx
tsconfig.json
vite.config.ts
vitest.config.ts
```
