// Todas as operações do banco sobre a coleção "insumos".
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { ErroNegocio, traduzirErroMongo } = require('../erros');

const colecao = () => getDb().collection('insumos');

// Recurso: insertOne (cria um documento)
async function criarInsumo(dados) {
  const agora = new Date();
  try {
    const resultado = await colecao().insertOne({ ...limpar(dados), criado_em: agora, atualizado_em: agora });
    return resultado.insertedId;
  } catch (erro) {
    throw traduzirErroMongo(erro);
  }
}

// Recurso: find com filtro, $text, $expr, projeção e sort
async function listarInsumos({ categoria, baixo, q } = {}) {
  const filtro = {};
  if (categoria) filtro.categoria = categoria;
  if (baixo) filtro.$expr = { $lt: ['$estoque', '$estoque_minimo'] }; // compara dois campos do mesmo documento
  if (q) filtro.$text = { $search: q };
  const ordem = q ? { score: { $meta: 'textScore' } } : { nome: 1 };
  const projecao = q ? { score: { $meta: 'textScore' } } : {};
  return colecao().find(filtro, { projection: projecao }).sort(ordem).toArray();
}

// Recurso: findOne por _id
async function buscarInsumo(id) {
  if (!ObjectId.isValid(id)) return null;
  return colecao().findOne({ _id: new ObjectId(id) });
}

// Recurso: updateOne com $set (e $unset para o campo opcional)
async function editarInsumo(id, dados) {
  try {
    const atualizacao = { $set: { ...limpar(dados), atualizado_em: new Date() } };
    if (!dados.fabricante) atualizacao.$unset = { fabricante: '' }; // campo opcional apagado
    const resultado = await colecao().updateOne({ _id: new ObjectId(id) }, atualizacao);
    return resultado.matchedCount === 1;
  } catch (erro) {
    throw traduzirErroMongo(erro);
  }
}

// Recurso: countDocuments sobre campo de subdocumento dentro de array (operacoes.insumo._id)
async function contarTalhoesQueUsam(insumoId) {
  return getDb().collection('talhoes').countDocuments({ 'operacoes.insumo._id': new ObjectId(insumoId) });
}

// Recurso: deleteOne (recusado se o insumo estiver em uso)
async function excluirInsumo(id) {
  const emUso = await contarTalhoesQueUsam(id);
  if (emUso > 0) {
    throw new ErroNegocio(
      `Este insumo não pode ser excluído: é usado em operações de ${emUso} ${emUso === 1 ? 'talhão' : 'talhões'}.`,
    );
  }
  const resultado = await colecao().deleteOne({ _id: new ObjectId(id) });
  return resultado.deletedCount === 1;
}

// Recurso: find com $expr e projeção (insumos abaixo do estoque mínimo)
async function listarInsumosAbaixoDoMinimo() {
  return colecao()
    .find({ $expr: { $lt: ['$estoque', '$estoque_minimo'] } }, { projection: { nome: 1, unidade: 1, estoque: 1, estoque_minimo: 1, fabricante: 1 } })
    .sort({ nome: 1 })
    .toArray();
}

// Recurso: countDocuments com $expr
async function contarInsumosAbaixoDoMinimo() {
  return colecao().countDocuments({ $expr: { $lt: ['$estoque', '$estoque_minimo'] } });
}

// Recurso: find com projeção para montar o <select> do formulário de operação
async function listarInsumosParaSelecao() {
  return colecao()
    .find({}, { projection: { nome: 1, unidade: 1, estoque: 1, categoria: 1 } })
    .sort({ categoria: 1, nome: 1 })
    .toArray();
}

function limpar(d) {
  const doc = {
    nome: d.nome, categoria: d.categoria, unidade: d.unidade,
    estoque: d.estoque, estoque_minimo: d.estoque_minimo, preco_unitario: d.preco_unitario,
  };
  if (d.fabricante) doc.fabricante = d.fabricante;
  return doc;
}

module.exports = {
  criarInsumo, listarInsumos, buscarInsumo, editarInsumo, excluirInsumo,
  contarTalhoesQueUsam, listarInsumosAbaixoDoMinimo, contarInsumosAbaixoDoMinimo, listarInsumosParaSelecao,
};
