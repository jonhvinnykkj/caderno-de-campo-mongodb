// JavaScript mínimo: mostra o campo de produtividade quando o tipo é "colheita".
document.querySelectorAll('[data-tipo-operacao]').forEach((seletor) => {
  const alvo = document.querySelector(seletor.dataset.tipoOperacao);
  const atualizar = () => {
    if (alvo) alvo.hidden = seletor.value !== 'colheita';
  };
  seletor.addEventListener('change', atualizar);
  atualizar();
});
