// Apoio dos testes: conecta no banco de teste e recria dados mínimos.
process.env.NODE_ENV = 'test';
const { ObjectId } = require('mongodb');
const { conectar, fechar, getDb, NOME_BANCO } = require('../src/db');
const { configurarBanco } = require('../scripts/setup-banco');
const { criarApp } = require('../src/app');

async function preparar() {
  if (NOME_BANCO !== 'caderno_de_campo_teste') throw new Error('Os testes só podem rodar no banco de teste.');
  const db = await conectar();
  await configurarBanco(db);
  return db;
}

async function limpar() {
  await getDb().collection('talhoes').deleteMany({});
  await getDb().collection('insumos').deleteMany({});
}

async function inserirInsumo(extra = {}) {
  const doc = {
    nome: 'Ureia 45% N', categoria: 'fertilizante', fabricante: 'Yara', unidade: 'kg',
    estoque: 1000, estoque_minimo: 300, preco_unitario: 3.4, criado_em: new Date(), atualizado_em: new Date(), ...extra,
  };
  const { insertedId } = await getDb().collection('insumos').insertOne(doc);
  return { ...doc, _id: insertedId };
}

async function inserirTalhao(extra = {}) {
  const doc = {
    codigo: 'T01', nome: 'Baixada do Córrego', cultura: 'amendoim', variedade: 'IAC OL3', area_ha: 10, safra: '2026/27',
    status: 'em andamento', tags: ['irrigado'], operacoes: [], criado_em: new Date(), atualizado_em: new Date(), ...extra,
  };
  const { insertedId } = await getDb().collection('talhoes').insertOne(doc);
  return { ...doc, _id: insertedId };
}

const estoqueDe = async (id) => (await getDb().collection('insumos').findOne({ _id: new ObjectId(String(id)) })).estoque;
const talhaoDe = (id) => getDb().collection('talhoes').findOne({ _id: new ObjectId(String(id)) });

module.exports = { preparar, limpar, fechar, criarApp, inserirInsumo, inserirTalhao, estoqueDe, talhaoDe, getDb };
