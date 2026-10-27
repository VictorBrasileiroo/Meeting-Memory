export function FoundationNotice() {
  return <aside className="foundation-notice"><strong>{__FOUNDATION_MOCK__ ? 'Simulação de desenvolvimento' : 'Transcrição e notas'}</strong>
    <p>{__FOUNDATION_MOCK__ ? 'Os estados e exemplos são simulados. Nenhum áudio é capturado ou enviado.' : 'Áudio e transcrição são processados pela Gemini API. A transcrição é a fonte preservada; as notas são interpretação.'}</p></aside>;
}
