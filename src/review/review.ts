import { onMeetingChange } from '../storage/meeting-events';
import '../lib/ui-csp';
import '../styles/global.css';
import { listChunks, type Chunk } from '../storage/recordings';
import { readCaptureSnapshot } from '../background/capture-coordinator';

const root = document.getElementById('root')!;
root.innerHTML = '<div class="page-shell"><h1>Partes da gravação</h1><p>Diagnóstico local: reproduza cada WebM separadamente para verificar fronteiras.</p><div id="content" role="status">Carregando…</div></div>';
const content = document.getElementById('content')!;
const urls: string[] = [];
let viewedRecordingId: string | null = null;
const stopChanges = onMeetingChange(change => { if (change.recordingId !== viewedRecordingId) return; for (const url of urls) URL.revokeObjectURL(url); urls.length = 0; content.textContent = 'O conteúdo local desta reunião foi alterado. Atualize a página para consultar o estado atual.'; });
const time = (ms: number) => { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
function render(chunk: Chunk): HTMLElement {
  const section = document.createElement('section'); section.className = 'card';
  const heading = document.createElement('h2'); heading.textContent = `Parte ${chunk.index} · ${time(chunk.approximateStartMs)} → ${time(chunk.approximateEndMs)}`;
  const meta = document.createElement('p'); meta.textContent = `${chunk.status} · ${chunk.mimeType} · ${(chunk.blob.size / 1024 / 1024).toFixed(1)} MiB · duração ${chunk.measuredDurationMs === null ? 'não medida' : time(chunk.measuredDurationMs)} · overlap previsto ${chunk.overlapMs} ms`;
  if (!chunk.blob.size) { const removed = document.createElement('p'); removed.textContent = 'Áudio local apagado após transcrição e limpeza remota, conforme a retenção configurada.'; section.append(heading, meta, removed); return section; }
  const url = URL.createObjectURL(chunk.blob); urls.push(url);
  const audio = document.createElement('audio'); audio.controls = true; audio.src = url;
  const link = document.createElement('a'); link.href = url; link.download = `chunk-${String(chunk.index).padStart(3, '0')}.webm`; link.textContent = 'Salvar parte';
  section.append(heading, meta, audio, document.createElement('br'), link);
  return section;
}
void readCaptureSnapshot().then(async (snapshot) => {
  const recordingId = new URLSearchParams(window.location.search).get('recordingId') ?? snapshot.recordingId;
  if (!recordingId) { content.textContent = 'Nenhuma sessão selecionada.'; return; }
  viewedRecordingId = recordingId;
  const chunks = await listChunks(recordingId);
  if (!chunks.length) { content.textContent = 'Nenhuma parte salva nesta sessão.'; return; }
  content.replaceChildren(...chunks.map(render));
}).catch(() => { content.textContent = 'Não foi possível abrir as partes da gravação.'; });
window.addEventListener('pagehide', () => { stopChanges(); for (const url of urls) URL.revokeObjectURL(url); });
