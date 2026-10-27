import type { MeetingNotes } from '../domain/notes';
import { sectionLabels } from '../domain/notes';
import { profiles } from '../domain/profiles';
import { notesLimitation } from '../domain/notes-validation';

export const natureLabel = (nature: string) => nature === 'suggestion' ? 'Sugestão: ' : nature === 'hypothesis' ? 'Hipótese: ' : '';
function markdownText(text: string): string { return text.replace(/\\/g, '\\\\').replace(/([`*_{}[\]<>#+!|])/g, '\\$1').replace(/\r?\n/g, ' '); }
export function notesMarkdown(notes: MeetingNotes): string {
  const output = notes.output;
  const lines = [`# ${markdownText(output.title ?? `Reunião de ${profiles[notes.profile].label}`)}`, '', `Perfil: ${profiles[notes.profile].label}`, `Modelo: ${notes.analysisModel}`, `Gerado em: ${new Date(notes.createdAt).toISOString()}`, '', 'Notas geradas por interpretação da transcrição original.', ''];
  if (notes.validation) lines.push(notesLimitation(notes.validation), '');
  if (output.summary.length) lines.push('## Resumo', '', ...output.summary.map((item) => `${markdownText(natureLabel(item.nature) + item.text)}\n`));
  for (const section of output.sections.filter((section) => section.items.length)) lines.push(`## ${sectionLabels[section.kind]}`, '', ...section.items.map((item) => `- ${markdownText(natureLabel(item.nature) + item.text)}`), '');
  if (output.tasks.length) lines.push('## Tarefas', '', ...output.tasks.map((task) => `- ${markdownText(task.description)}${task.owner ? ` — Responsável: ${markdownText(task.owner)}` : ''}${task.deadline ? ` — Prazo: ${markdownText(task.deadline)}` : ''}`), '');
  if (!output.summary.length && !output.tasks.length && !output.sections.some((section) => section.items.length)) lines.push('Não encontramos conteúdo suficiente para organizar notas.', '');
  return lines.join('\n');
}
export async function copyNotes(notes: MeetingNotes): Promise<void> { await navigator.clipboard.writeText(notesMarkdown(notes)); }
export function downloadNotes(notes: MeetingNotes): void {
  const url = URL.createObjectURL(new Blob([notesMarkdown(notes)], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  try { link.href = url; link.download = `meeting-memory-${notes.recordingId.replace(/[^a-zA-Z0-9-]/g, '')}.md`; document.body.appendChild(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
