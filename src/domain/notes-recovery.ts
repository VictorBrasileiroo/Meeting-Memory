import { notesOutputSchema, validateNotesOutput, type NotesOutput } from './notes';
import { evidenceMatcher } from './note-evidence';
import type { Profile } from './profiles';
import { notesValidationSchema, type NotesValidation } from './notes-validation';

export type AnalyzedNotes = NotesOutput & { validation?: NotesValidation };

// Strict structure remains a global gate. Only semantically invalid *items*
// are omitted. This report has enum codes/counts, never content or model paths.
export function recoverNotesOutput(value: unknown, profile: Profile, sources: readonly { chunkId: string; rawText: string }[]): AnalyzedNotes {
  const parsed = notesOutputSchema(profile).parse(value);
  const matchers = new Map(sources.map(source => [source.chunkId, evidenceMatcher(source.rawText)]));
  const counts = new Map<NotesValidation['issues'][number]['code'], number>();
  let omittedItems = 0; let recoveredQuotes = 0;
  const issue = (code: NotesValidation['issues'][number]['code']) => counts.set(code, (counts.get(code) ?? 0) + 1);
  const checkEvidence = (refs: NotesOutput['summary'][number]['evidence']) => {
    let valid = true;
    for (const ref of refs) {
      const matcher = matchers.get(ref.chunkId);
      const literal = matcher?.(ref.quote);
      if (literal) { if (literal !== ref.quote) recoveredQuotes++; ref.quote = literal; }
      else {
        valid = false;
        issue(!matcher ? 'UNKNOWN_PART' : [...matchers.entries()].some(([id, match]) => id !== ref.chunkId && match(ref.quote)) ? 'WRONG_PART' : 'EVIDENCE_NOT_FOUND');
      }
    }
    return valid;
  };
  const checkItem = (item: NotesOutput['summary'][number], decision = false) => {
    const evidence = checkEvidence(item.evidence);
    const nature = !decision || item.nature === 'established';
    if (!nature) issue('INVALID_NATURE');
    if (!evidence || !nature) { omittedItems++; return false; }
    return true;
  };
  parsed.summary = parsed.summary.filter(item => checkItem(item));
  const merged = new Map<NotesOutput['sections'][number]['kind'], NotesOutput['sections'][number]>();
  for (const section of parsed.sections) {
    const items = section.items.filter(item => checkItem(item, ['decisions', 'methodologicalDecisions', 'architectureDecisions'].includes(section.kind)));
    const existing = merged.get(section.kind);
    if (existing) { issue('DUPLICATE_SECTION'); existing.items.push(...items); }
    else merged.set(section.kind, { ...section, items });
  }
  parsed.sections = [...merged.values()];
  for (const section of parsed.sections) {
    const seen = new Set<string>();
    section.items = section.items.filter(item => { const key = `${item.nature}:${item.text}`; if (seen.has(key)) return false; seen.add(key); return true; });
    if (section.items.length > 200) {
      const excess = section.items.length - 200; omittedItems += excess;
      for (let index = 0; index < excess; index++) issue('SECTION_LIMIT');
      section.items = section.items.slice(0, 200);
    }
  }
  parsed.tasks = parsed.tasks.filter(task => {
    let valid = checkEvidence(task.evidence);
    if (profile === 'class') { issue('TASKS_OUTSIDE_PROFILE'); valid = false; }
    for (const [field, code] of [['owner', 'UNSUPPORTED_OWNER'], ['deadline', 'UNSUPPORTED_DEADLINE']] as const) {
      const assignment = task[field];
      if (assignment !== null && !task.evidence.some(ref => evidenceMatcher(ref.quote)(assignment))) { issue(code); valid = false; }
    }
    if (!valid) omittedItems++;
    return valid;
  });
  if (!parsed.summary.length && !parsed.tasks.length && !parsed.sections.some(section => section.items.length)) parsed.title = null;
  // Recheck the exact contract, deduplication and literal evidence before return.
  const output = validateNotesOutput(parsed, profile, sources);
  if (!counts.size && !recoveredQuotes) return output;
  return { ...output, validation: notesValidationSchema.parse({ version: 1, omittedItems, recoveredQuotes, issues: [...counts].map(([code, count]) => ({ code, count })) }) };
}

