import '../styles/global.css';
const root = document.getElementById('root')!;
root.innerHTML = '<div class="page-shell"><h1>Autorizar microfone</h1><p>Esta página pede acesso somente para testar a permissão. A gravação começa depois, por uma nova ação na aba da reunião.</p><button id="authorize" class="button primary">Autorizar microfone</button><p id="status" role="status"></p></div>';
document.getElementById('authorize')!.addEventListener('click', async () => {
  const status = document.getElementById('status')!;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => track.stop());
    status.textContent = 'Microfone autorizado. Volte à aba da reunião e inicie novamente.';
  } catch {
    status.textContent = 'Permissão não concedida. Verifique as permissões do microfone no Edge e no Windows e tente novamente.';
  }
});
