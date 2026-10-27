export type SpeakerTurn = { speaker: string | null; text: string };
export function speakerTurns(annotations: unknown[]): SpeakerTurn[] {
  const turns: SpeakerTurn[] = [];
  for (const item of annotations) {
    if (!item || typeof item !== 'object') continue;
    const word = item as { type?: unknown; speaker?: unknown; text?: unknown };
    if (word.type !== 'word_info' || typeof word.text !== 'string' || !word.text) continue;
    const speaker = typeof word.speaker === 'string' && word.speaker ? word.speaker : null;
    const last = turns.at(-1);
    if (last?.speaker === speaker) last.text += `${/^\s|^[,.!?;:]/.test(word.text) ? '' : ' '}${word.text}`;
    else turns.push({ speaker, text: word.text });
  }
  return turns;
}
