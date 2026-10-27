// Formatting only: no case folding, accent removal, fuzzy spelling, number
// changes or punctuation deletion. In particular, “Não, aprovado” != “Não aprovado”.
type MappedText = { text: string; starts: number[]; ends: number[] };
const punctuation = /[.,;:!?()[\]{}"'“”‘’…]/u;
const word = /[\p{L}\p{M}\p{N}_]/u;
function canonical(raw: string): MappedText {
  const units = Array.from(raw.matchAll(/\S|\s+/gu), match => ({ value: match[0], start: match.index, end: match.index + match[0].length }));
  const result: MappedText = { text: '', starts: [], ends: [] };
  units.forEach((unit, index) => {
    let value = unit.value;
    if (/^\s/u.test(value)) {
      if (!index || index === units.length - 1 || punctuation.test(units[index - 1]!.value) || punctuation.test(units[index + 1]!.value)) return;
      value = ' ';
    } else value = value.replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'").replace(/…/gu, '...');
    result.text += value;
    for (let i = 0; i < value.length; i++) { result.starts.push(unit.start); result.ends.push(unit.end); }
  });
  return result;
}
function bounded(raw: string, start: number, end: number): boolean {
  return !(word.test(raw[start] ?? '') && word.test(raw[start - 1] ?? ''))
    && !(word.test(raw[end - 1] ?? '') && word.test(raw[end] ?? ''));
}
export function evidenceMatcher(raw: string): (quote: string) => string | null {
  let mapped: MappedText | undefined;
  return quote => {
    // Exact literal citations may legitimately recur (overlap/repeated speech).
    for (let at = raw.indexOf(quote); at !== -1; at = raw.indexOf(quote, at + 1)) {
      if (bounded(raw, at, at + quote.length)) return raw.slice(at, at + quote.length);
    }
    mapped ??= canonical(raw);
    const needle = canonical(quote).text;
    if (!needle) return null;
    let literal: string | null = null;
    let matches = 0;
    for (let at = mapped.text.indexOf(needle); at !== -1; at = mapped.text.indexOf(needle, at + 1)) {
      const start = mapped.starts[at]!; const end = mapped.ends[at + needle.length - 1]!;
      if (!bounded(raw, start, end)) continue;
      literal = raw.slice(start, end);
      if (++matches > 1) return null; // Never guess which original span was intended.
    }
    return literal;
  };
}
