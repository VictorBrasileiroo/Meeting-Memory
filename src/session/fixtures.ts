import type { SessionView } from '../domain/contracts';

// Importado somente nas prévias de desenvolvimento/build:fixtures.
export const sessionFixtures: Record<string, SessionView> = {
  processing: { status: 'PROCESSING', interrupted: false, title: 'Processamento — exemplo local', summary: [], sections: [], transcript: null },
  completed: { status: 'COMPLETED', interrupted: false, title: 'Conversa de exemplo', summary: ['Exemplo fictício de uma conversa sobre organizar a próxima etapa do projeto.'], sections: [
    { id: 'topics', title: 'Principais assuntos', items: ['Preparação da fundação e revisão da documentação.'] },
    { id: 'experiments', title: 'Experimentos', items: [] },
  ], transcript: 'Parte 1 · Falante 1\nVamos revisar a documentação antes de seguir.\n\nParte 1 · Falante 2\nSim, podemos começar pela fundação.' },
  error: { status: 'ERROR', interrupted: false, title: 'Erro — exemplo local', summary: [], sections: [], transcript: 'Parte 1 · Falante 1\nEste texto é apenas uma fixture de apresentação.' },
  interrupted: { status: 'COMPLETED', interrupted: true, title: 'Interrupção — exemplo local', summary: ['Este exemplo representa somente a parte recuperada.'], sections: [], transcript: 'Parte 1 · Falante 1\nEste trecho é um exemplo fictício de material recuperado.' },
  empty: { status: 'COMPLETED', interrupted: false, title: 'Ausência de notas — exemplo local', summary: [], sections: [{ id: 'references', title: 'Referências', items: [] }], transcript: '' },
};
