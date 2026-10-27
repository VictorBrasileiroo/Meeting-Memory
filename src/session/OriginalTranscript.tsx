import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { TranscriptChunk } from '../storage/recordings';
import { TranscriptPart } from './TranscriptPart';

export const transcriptText = (transcripts: readonly TranscriptChunk[]) => transcripts.map(item => `Parte ${item.chunkIndex}\n${item.rawText}`).join('\n\n');

export function OriginalTranscript({ transcripts, expanded = false }: { transcripts: readonly TranscriptChunk[]; expanded?: boolean }) {
  const [notice, setNotice] = useState('');
  const content = <div className="reading-column transcript-document">
    <div className="document-toolbar"><h2 id="transcript-heading" tabIndex={-1}>Transcrição original</h2>
      <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(transcriptText(transcripts)).then(() => setNotice('Transcrição copiada.')).catch(() => setNotice('Não foi possível copiar a transcrição. Tente novamente.'))} disabled={!transcripts.length}><Copy aria-hidden="true" />Copiar transcrição</Button></div>
    <p className="action-feedback" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
    <p className="transcript-context">Texto integral, preservado como foi transcrito. Quando disponíveis, os falantes são identificados somente dentro de cada parte. Trechos de fronteira podem se repetir.</p>
    {transcripts.length > 1 && <nav className="part-navigation" aria-label="Partes da transcrição">{transcripts.map(transcript => <a key={transcript.id} href={`#source-${encodeURIComponent(transcript.chunkId)}`}>Parte {transcript.chunkIndex}</a>)}</nav>}
    {!transcripts.length && <p className="empty-reading">Ainda não há transcrição salva nesta sessão.</p>}
    {transcripts.map(transcript => <div className="transcript-source" key={transcript.id} id={`source-${transcript.chunkId}`} tabIndex={-1}><TranscriptPart transcript={transcript} /></div>)}
  </div>;
  if (expanded) return content;
  if (!transcripts.length) return null;
  return <details className="transcript-card"><summary>Ver transcrição original</summary>{content}</details>;
}
