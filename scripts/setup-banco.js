// Cria as coleções com validador $jsonSchema e os índices. Idempotente (usa collMod se já existir).
const { conectar, fechar, NOME_BANCO } = require('../src/db');

const CULTURAS = ['amendoim', 'milho', 'soja', 'cana-de-açúcar', 'café', 'pousio'];
const TIPOS = ['preparo de solo', 'plantio', 'adubação', 'pulverização', 'colheita'];

// Validador da coleção insumos
const validadorInsumos = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['nome', 'categoria', 'unidade', 'estoque', 'estoque_minimo', 'preco_unitario'],
    properties: {
      nome: { bsonType: 'string', minLength: 2, maxLength: 80 },
      categoria: { enum: ['semente', 'fertilizante', 'defensivo', 'corretivo'] },
      fabricante: { bsonType: 'string' },
      unidade: { enum: ['kg', 'L', 'sc'] },
      estoque: { bsonType: 'number', minimum: 0 },
      estoque_minimo: { bsonType: 'number', minimum: 0 },
      preco_unitario: { bsonType: 'number', minimum: 0 },
      criado_em: { bsonType: 'date' },
      atualizado_em: { bsonType: 'date' },
    },
  },
};

// Validador da coleção talhoes (com as operações embutidas)
const validadorTalhoes = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['codigo', 'nome', 'cultura', 'area_ha', 'safra', 'status', 'operacoes'],
    properties: {
      codigo: { bsonType: 'string', pattern: '^T[0-9]{2}$' },
      nome: { bsonType: 'string', minLength: 2, maxLength: 80 },
      cultura: { enum: CULTURAS },
      variedade: { bsonType: 'string' },
      area_ha: { bsonType: 'number', exclusiveMinimum: true, minimum: 0 },
      safra: { bsonType: 'string', pattern: '^[0-9]{4}/[0-9]{2}$' },
      status: { enum: ['planejado', 'em andamento', 'colhido'] },
      tags: { bsonType: 'array', items: { bsonType: 'string' } },
      operacoes: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['_id', 'tipo', 'data', 'responsavel'],
          properties: {
            tipo: { enum: TIPOS },
            data: { bsonType: 'date' },
            insumo: { bsonType: ['object', 'null'] },
            dose_por_ha: { bsonType: ['number', 'null'] },
            quantidade_total: { bsonType: ['number', 'null'] },
            produtividade_sc_ha: { bsonType: ['number', 'null'] },
            responsavel: { bsonType: 'string' },
            observacao: { bsonType: 'string' },
          },
        },
      },
      criado_em: { bsonType: 'date' },
      atualizado_em: { bsonType: 'date' },
    },
  },
};

async function garantirColecao(db, nome, validador) {
  const existe = await db.listCollections({ name: nome }).hasNext();
  if (existe) {
    // collMod troca o validador de uma coleção que já existe
    await db.command({ collMod: nome, validator: validador, validationLevel: 'strict', validationAction: 'error' });
  } else {
    await db.createCollection(nome, { validator: validador, validationLevel: 'strict', validationAction: 'error' });
  }
}

async function configurarBanco(db) {
  await garantirColecao(db, 'insumos', validadorInsumos);
  await garantirColecao(db, 'talhoes', validadorTalhoes);

  const talhoes = db.collection('talhoes');
  await talhoes.createIndex({ codigo: 1 }, { unique: true, name: 'codigo_unico' });
  await talhoes.createIndex({ nome: 'text', variedade: 'text', tags: 'text' }, { name: 'busca_texto', default_language: 'portuguese' });
  await talhoes.createIndex({ cultura: 1 }, { name: 'por_cultura' });
  await talhoes.createIndex({ 'operacoes.data': -1 }, { name: 'operacoes_data' });

  const insumos = db.collection('insumos');
  await insumos.createIndex({ nome: 'text', fabricante: 'text' }, { name: 'busca_texto', default_language: 'portuguese' });
  await insumos.createIndex({ categoria: 1 }, { name: 'por_categoria' });
}

module.exports = { configurarBanco, validadorInsumos, validadorTalhoes };

if (require.main === module) {
  (async () => {
    const db = await conectar();
    await configurarBanco(db);
    console.log(`Banco "${NOME_BANCO}" configurado: coleções, validadores $jsonSchema e índices.`);
    await fechar();
  })().catch((e) => {
    console.error('Falha ao configurar o banco:', e.message);
    process.exit(1);
  });
}
