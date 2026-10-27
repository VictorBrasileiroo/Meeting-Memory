// Synthetic fixture from the official steps/content/word_info contract.
// Not a captured API response or evidence of real diarization quality.
export const twoSpeakerResponse = {
  id: 'interactions/test-only', model: 'gemini-3.5-transcribe', status: 'completed',
  steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Bom dia. Vamos começar? Sim.', annotations: [
    { type: 'word_info', text: 'Bom dia.', speaker: 'spk_1' },
    { type: 'word_info', text: 'Vamos começar?' },
    { type: 'word_info', text: 'Sim.', speaker: 'spk_2' },
  ] }] }],
};
