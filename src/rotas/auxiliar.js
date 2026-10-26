const { ErroNegocio } = require('../erros');

function naoEncontrado(res, oQue) {
  return res.status(404).render('erro', { titulo: 'Não encontrado', ativo: '', codigo: 404, mensagem: `${oQue} não foi encontrado no caderno.` });
}

// Aplica à lista de erros do formulário o erro de regra de negócio, se tiver campo; senão devolve false.
function erroNoCampo(erro, erros) {
  if (!(erro instanceof ErroNegocio)) throw erro;
  erros[erro.campo || '_geral'] = erro.message;
}

module.exports = { naoEncontrado, erroNoCampo };
