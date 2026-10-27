import { onMeetingChange } from '../storage/meeting-events';
import { useEffect, useState } from 'react';
import { Download, Headphones, Play, VolumeX } from 'lucide-react';
import { Button } from '../components/ui/button';
import { getChunk, type Chunk } from '../storage/recordings';
import type { PartReference } from './session-data';

function AudioPartPlayer({ part, retention, recordingId }: { part: PartReference; retention?: string; recordingId?: string }) {
  const [state, setState] = useState<{ loaded?: boolean; chunk?: Chunk; url?: string; error?: string }>({});
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    const release = () => { if (url) { URL.revokeObjectURL(url); url = undefined; } };
    void getChunk(part.id).then(chunk => {
      if (!active) return;
      if (chunk?.blob.size) url = URL.createObjectURL(chunk.blob);
      setState({ loaded: true, chunk, url });
    }).catch(() => { if (active) setState({ error: 'Não foi possível carregar esta parte. Selecione-a novamente para tentar.' }); });
    const stopChanges = onMeetingChange(change => { if (recordingId && change.recordingId !== recordingId) return; active = false; release(); setState({ error: 'O conteúdo local foi alterado em outra página. Feche e reabra esta parte para consultar o estado atual.' }); });
    const onPageHide = (event: PageTransitionEvent) => { if (!event.persisted) release(); };
    window.addEventListener('pagehide', onPageHide);
    return () => { active = false; release(); stopChanges(); window.removeEventListener('pagehide', onPageHide); };
  }, [part.id, recordingId]);
  if (state.error) return <p role="alert">{state.error}</p>;
  if (!state.loaded) return <p role="status">Carregando áudio…</p>;
  if (!state.chunk) return <p className="text-sm text-muted-foreground">Áudio indisponível: esta parte não está mais salva no dispositivo.</p>;
  if (!state.url) return <p className="flex items-start gap-2 text-sm text-muted-foreground"><VolumeX aria-hidden="true" className="size-4 shrink-0" />{!state.chunk.blob.size && retention === 'delete-after-transcription' ? 'Áudio removido após transcrição, conforme a retenção desta sessão.' : 'Áudio indisponível nesta parte.'}</p>;
  const duration = state.chunk.measuredDurationMs;
  const extension = state.chunk.mimeType.startsWith('audio/webm') ? 'webm' : state.chunk.mimeType.startsWith('audio/wav') ? 'wav' : 'audio';
  return <div className="audio-player">
    {duration !== null && Number.isFinite(duration) && duration > 0 && <p className="text-sm text-muted-foreground">Duração medida: {Math.floor(duration / 60000)}min {Math.floor(duration / 1000) % 60}s</p>}
    <audio aria-label={`Áudio da parte ${part.index}`} controls preload="metadata" src={state.url} onError={() => setState(previous => ({ ...previous, error: 'Este áudio não pôde ser reproduzido pelo navegador. Tente abrir esta parte novamente.' }))} />
    <Button asChild variant="ghost" size="sm" className="mt-3"><a href={state.url} download={`chunk-${String(part.index).padStart(3, '0')}.${extension}`}><Download aria-hidden="true" />Salvar parte</a></Button>
  </div>;
}

export function AudioParts({ parts, retention, recordingId, revision = 0 }: { parts: readonly PartReference[]; retention?: string; recordingId?: string; revision?: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <section className="reading-column audio-content" aria-labelledby="audio-heading">
    <div className="section-heading"><Headphones aria-hidden="true" className="size-5 text-muted-foreground" /><h2 id="audio-heading">Gravação da reunião</h2></div>
    <p className="text-sm text-muted-foreground">Selecione uma parte para ouvir. O áudio é carregado somente quando você o abre.</p>
    {!parts.length && <p className="empty-reading">Nenhuma parte de áudio salva nesta sessão.</p>}
    <ol className="audio-parts">{parts.map(part => <li key={part.id}>
      <Button variant={selected === part.id ? 'secondary' : 'ghost'} className="justify-start" aria-expanded={selected === part.id} aria-controls={`audio-${part.id}`} onClick={() => setSelected(selected === part.id ? null : part.id)}><Play aria-hidden="true" />Parte {part.index}<span className="ml-auto text-xs">{selected === part.id ? 'Fechar' : 'Ouvir'}</span></Button>
      <div id={`audio-${part.id}`}>{selected === part.id && <AudioPartPlayer key={`${part.id}:${revision}`} part={part} retention={retention} recordingId={recordingId} />}</div>
    </li>)}</ol>
    <p className="reading-footnote">As partes são arquivos independentes. Não há marcação de tempo exata entre as notas e o áudio.</p>
  </section>;
}
