import { speakerTurns } from '../gemini/speaker-turns';
import type { TranscriptChunk } from '../storage/recordings';

export function TranscriptPart({ transcript }: { transcript: TranscriptChunk }) {
  const turns = speakerTurns(transcript.annotations);
  return <section><h3>Parte {transcript.chunkIndex}</h3><p className="transcript-text">{transcript.rawText || 'Nenhuma fala reconhecida.'}</p>
    {turns.some((turn) => turn.speaker !== null) && <details className="speaker-annotations"><summary>Trechos por falante · anotações</summary>{turns.map((turn, index) => <p key={index}><strong>{turn.speaker ? `Parte ${transcript.chunkIndex} · Falante ${turn.speaker.replace(/^spk_/, '')}` : 'Falante não identificado'}:</strong> {turn.text}</p>)}</details>}
  </section>;
}
