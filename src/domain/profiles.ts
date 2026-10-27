import { z } from 'zod';

export const PROFILE_IDS = ['general', 'research', 'development', 'class'] as const;
export const profileSchema = z.enum(PROFILE_IDS);
export type Profile = z.infer<typeof profileSchema>;
export const profiles: Record<Profile, { label: string; description: string }> = {
  general: { label: 'Geral', description: 'Assuntos, decisões e próximos passos da conversa.' },
  research: { label: 'Pesquisa', description: 'Orientações, hipóteses e caminhos para sua pesquisa.' },
  development: { label: 'Desenvolvimento', description: 'Requisitos, decisões técnicas e mudanças discutidas.' },
  class: { label: 'Aula', description: 'Conceitos, exemplos e pontos importantes da aula.' },
};
