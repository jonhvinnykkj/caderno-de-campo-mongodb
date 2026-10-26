// Todas as operações do banco sobre a coleção "talhoes" e suas operações embutidas.
// Obs.: o MongoDB local (standalone) não tem transação multi-documento; por isso o estoque
// é mexido com updateOne condicional e desfeito à mão se o passo seguinte falhar.
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { ErroNegocio, traduzirErroMongo } = require('../erros');

const colecao = () => getDb().collection('talhoes');
const insumos = () => getDb().collection('insumos');

const POR_PAGINA = 8;
const ORDENS = { codigo: { codigo: 1 }, area: { area_ha: -1 }, nome: { nome: 1 } };

// ---------- Talhões ----------

// Recurso: insertOne; índice único em "codigo" gera o erro 11000
async function criarTalhao(dados) {
  const agora = new Date();
  try {
    const resultado = await colecao().insertOne({
      codigo: dados.codigo, nome: dados.nome, cultura: dados.cultura,
      ...(dados.variedade ? { variedade: dados.variedade } : {}),
      area_ha: dados.area_ha, safra: dados.safra, status: dados.status,
      tags: dados.tags || [], operacoes: [], criado_em: agora, atualizado_em: agora,
    });
    return resultado.insertedId;
  } catch (erro) {
    throw traduzirErroMongo(erro, { codigo: dados.codigo });
  }
}

// Recurso: find com filtro, $text + textScore, projeção ($size), sort, skip e limit; countDocuments para a paginação
async function listarTalhoes({ cultura, status, q, ordem = 'codigo', pagina = 1 } = {}) {
  const filtro = {};
  if (cultura) filtro.cultura = cultura;
  if (status) filtro.status = status;
  if (q) filtro.$text = { $search: q };

  const projecao = {
    codigo: 1, nome: 1, cultura: 1, variedade: 1, area_ha: 1, safra: 1, status: 1,
    n_operacoes: { $size: '$operacoes' }, // conta as operações sem trazer o array
  };
  if (q) projecao.score = { $meta: 'textScore' };
  const ordenacao = q ? { score: { $meta: 'textScore' } } : ORDENS[ordem] || ORDENS.codigo;

  const total = await colecao().countDocuments(filtro);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(Math.max(1, Number(pagina) || 1), paginas);
  const itens = await colecao()
    .find(filtro, { projection: projecao })
    .sort(ordenacao)
    .skip((paginaAtual - 1) * POR_PAGINA)
    .limit(POR_PAGINA)
    .toArray();
  return { itens, total, paginas, pagina: paginaAtual };
}

// Recurso: findOne por _id
async function buscarTalhao(id) {
  if (!ObjectId.isValid(id)) return null;
  return colecao().findOne({ _id: new ObjectId(id) });
}

// Recurso: updateOne com $set
async function editarTalhao(id, dados) {
  const atualizacao = {
    $set: {
      codigo: dados.codigo, nome: dados.nome, cultura: dados.cultura, area_ha: dados.area_ha,
      safra: dados.safra, status: dados.status, tags: dados.tags || [], atualizado_em: new Date(),
    },
  };
  if (dados.variedade) atualizacao.$set.variedade = dados.variedade;
  else atualizacao.$unset = { variedade: '' };
  try {
    const resultado = await colecao().updateOne({ _id: new ObjectId(id) }, atualizacao);
    return resultado.matchedCount === 1;
  } catch (erro) {
    throw traduzirErroMongo(erro, { codigo: dados.codigo });
  }
}

// Recurso: findOneAndDelete + $inc (as operações vão junto no documento; o estoque volta)
async function excluirTalhao(id) {
  const removido = await colecao().findOneAndDelete({ _id: new ObjectId(id) });
  if (!removido) return false;
  for (const op of removido.operacoes || []) {
    if (op.insumo && op.quantidade_total) await ajustarEstoque(op.insumo._id, op.quantidade_total);
  }
  return true;
}

// ---------- Operações embutidas ----------

// Muda o estoque de um insumo. Delta negativo (consumo) só acontece se houver saldo: filtro estoque >= consumo.
// Recurso: updateOne com $inc
async function ajustarEstoque(insumoId, delta) {
  const filtro = { _id: new ObjectId(insumoId) };
  if (delta < 0) filtro.estoque = { $gte: -delta };
  const resultado = await insumos().updateOne(filtro, { $inc: { estoque: delta }, $set: { atualizado_em: new Date() } });
  return resultado.matchedCount === 1;
}

async function montarOperacao(talhao, dados, insumoAtual) {
  let insumo = null;
  let quantidade = null;
  if (dados.insumo_id) {
    const doc = await insumos().findOne({ _id: new ObjectId(dados.insumo_id) });
    if (!doc) throw new ErroNegocio('Insumo não encontrado.', 'insumo_id');
    // mantém a cópia congelada (preço do dia) se o insumo da operação não mudou
    insumo = insumoAtual && String(insumoAtual._id) === String(doc._id)
      ? insumoAtual
      : { _id: doc._id, nome: doc.nome, unidade: doc.unidade, preco_unitario: doc.preco_unitario };
    quantidade = Math.round(dados.dose_por_ha * talhao.area_ha * 100) / 100;
  }
  return {
    tipo: dados.tipo,
    data: new Date(`${dados.data}T00:00:00Z`),
    insumo,
    dose_por_ha: insumo ? dados.dose_por_ha : null,
    quantidade_total: quantidade,
    produtividade_sc_ha: dados.tipo === 'colheita' ? dados.produtividade_sc_ha : null,
    responsavel: dados.responsavel,
    observacao: dados.observacao || '',
  };
}

function erroEstoque(op, insumoNome) {
  return new ErroNegocio(`Estoque insuficiente de ${insumoNome}: a operação precisa de ${op} e o saldo não cobre.`, 'dose_por_ha');
}

// Recurso: $push no array embutido + $inc negativo no estoque do insumo
async function registrarOperacao(talhaoId, dados) {
  const talhao = await buscarTalhao(talhaoId);
  if (!talhao) throw new ErroNegocio('Talhão não encontrado.');
  const operacao = { _id: new ObjectId(), ...(await montarOperacao(talhao, dados, null)) };

  if (operacao.insumo) {
    const baixou = await ajustarEstoque(operacao.insumo._id, -operacao.quantidade_total);
    if (!baixou) throw erroEstoque(`${operacao.quantidade_total} ${operacao.insumo.unidade}`, operacao.insumo.nome);
  }
  try {
    await colecao().updateOne(
      { _id: talhao._id },
      { $push: { operacoes: operacao }, $set: { atualizado_em: new Date() } },
    );
  } catch (erro) {
    if (operacao.insumo) await ajustarEstoque(operacao.insumo._id, operacao.quantidade_total); // desfaz a baixa
    throw traduzirErroMongo(erro);
  }
  return operacao._id;
}

// Recurso: updateOne com operador posicional filtrado ("operacoes.$[op]" + arrayFilters) e acerto da diferença de estoque
async function editarOperacao(talhaoId, operacaoId, dados) {
  const talhao = await buscarTalhao(talhaoId);
  const antiga = talhao && talhao.operacoes.find((o) => String(o._id) === String(operacaoId));
  if (!antiga) throw new ErroNegocio('Operação não encontrada.');
  const nova = await montarOperacao(talhao, dados, antiga.insumo);

  const qtdAntiga = antiga.insumo ? antiga.quantidade_total : 0;
  const qtdNova = nova.insumo ? nova.quantidade_total : 0;
  const mesmoInsumo = antiga.insumo && nova.insumo && String(antiga.insumo._id) === String(nova.insumo._id);

  // 1) retira do estoque o que falta (ou a diferença); 2) grava; 3) devolve o que sobrou da operação antiga
  if (mesmoInsumo) {
    if (!(await ajustarEstoque(nova.insumo._id, qtdAntiga - qtdNova))) throw erroEstoque(`${qtdNova - qtdAntiga} ${nova.insumo.unidade} a mais`, nova.insumo.nome);
  } else if (nova.insumo && !(await ajustarEstoque(nova.insumo._id, -qtdNova))) {
    throw erroEstoque(`${qtdNova} ${nova.insumo.unidade}`, nova.insumo.nome);
  }

  try {
    await colecao().updateOne(
      { _id: talhao._id },
      { $set: { 'operacoes.$[op]': { _id: antiga._id, ...nova }, atualizado_em: new Date() } },
      { arrayFilters: [{ 'op._id': antiga._id }] },
    );
  } catch (erro) {
    if (mesmoInsumo) await ajustarEstoque(nova.insumo._id, qtdNova - qtdAntiga);
    else if (nova.insumo) await ajustarEstoque(nova.insumo._id, qtdNova);
    throw traduzirErroMongo(erro);
  }
  if (!mesmoInsumo && antiga.insumo) await ajustarEstoque(antiga.insumo._id, qtdAntiga);
}

// Recurso: $pull no array embutido + $inc positivo (devolve o estoque)
async function excluirOperacao(talhaoId, operacaoId) {
  const talhao = await buscarTalhao(talhaoId);
  const operacao = talhao && talhao.operacoes.find((o) => String(o._id) === String(operacaoId));
  if (!operacao) return false;
  await colecao().updateOne(
    { _id: talhao._id },
    { $pull: { operacoes: { _id: operacao._id } }, $set: { atualizado_em: new Date() } },
  );
  if (operacao.insumo && operacao.quantidade_total) await ajustarEstoque(operacao.insumo._id, operacao.quantidade_total);
  return true;
}

module.exports = {
  POR_PAGINA, criarTalhao, listarTalhoes, buscarTalhao, editarTalhao, excluirTalhao,
  registrarOperacao, editarOperacao, excluirOperacao,
};
