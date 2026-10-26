// Erro de regra de negócio: a mensagem é mostrada ao usuário como está.
class ErroNegocio extends Error {
  constructor(mensagem, campo = null) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.campo = campo;
  }
}

// Converte erros conhecidos do MongoDB em mensagens amigáveis.
function traduzirErroMongo(erro, contexto = {}) {
  if (erro && erro.code === 11000) {
    return new ErroNegocio(`Já existe um talhão com o código ${contexto.codigo || ''}`.trim(), 'codigo');
  }
  if (erro && erro.code === 121) {
    return new ErroNegocio('O banco recusou o documento: algum campo não respeita o validador $jsonSchema da coleção.');
  }
  return erro;
}

module.exports = { ErroNegocio, traduzirErroMongo };
