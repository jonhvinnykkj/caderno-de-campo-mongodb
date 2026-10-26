const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const h = require('./auxiliar');
const rel = require('../src/repositorios/relatorios');
const insumosRepo = require('../src/repositorios/insumos');

let app;
before(async () => {
  await h.preparar();
  app = h.criarApp();
  await h.limpar();
  const ureia = await h.inserirInsumo({ estoque: 100, estoque_minimo: 300 });
  const t1 = await h.inserirTalhao({ codigo: 'T01', cultura: 'soja', area_ha: 10 });
  await h.inserirTalhao({ codigo: 'T02', cultura: 'soja', area_ha: 5 });
  await h.inserirTalhao({ codigo: 'T03', cultura: 'milho', area_ha: 20 });
  const ap = (data, extra) => request(app).post(`/talhoes/${t1._id}/operacoes`).type('form').send({ tipo: 'adubação', data, responsavel: 'João', ...extra });
  // a baixa precisa caber no estoque: reabastece antes
  await h.getDb().collection('insumos').updateOne({ _id: ureia._id }, { $set: { estoque: 2000 } });
  await ap('2026-09-01', { insumo_id: String(ureia._id), dose_por_ha: '10' });
  await request(app).post(`/talhoes/${t1._id}/operacoes`).type('form').send({ tipo: 'colheita', data: '2026-09-20', responsavel: 'Rogério', produtividade_sc_ha: '60' });
  await request(app).post(`/talhoes/${t1._id}/operacoes`).type('form').send({ tipo: 'colheita', data: '2026-09-25', responsavel: 'Rogério', produtividade_sc_ha: '66' });
  await h.getDb().collection('insumos').updateOne({ _id: ureia._id }, { $set: { estoque: 100 } });
});
after(h.fechar);

test('área total por cultura ($group)', async () => {
  const r = await rel.areaPorCultura();
  assert.deepEqual(r.map((c) => [c._id, c.area_ha, c.talhoes]), [['milho', 20, 1], ['soja', 15, 2]]);
});

test('operações por tipo ($unwind + $group)', async () => {
  const r = await rel.operacoesPorTipo();
  assert.deepEqual(Object.fromEntries(r.map((t) => [t._id, t.total])), { colheita: 2, adubação: 1 });
});

test('últimas operações em ordem decrescente de data', async () => {
  const r = await rel.ultimasOperacoes(2);
  assert.equal(r.length, 2);
  assert.ok(r[0].operacao.data >= r[1].operacao.data);
  assert.equal(r[0].operacao.produtividade_sc_ha, 66);
});

test('custo por talhão usa $lookup para trazer a categoria', async () => {
  const [c] = await rel.custoPorTalhao();
  assert.equal(c._id, 'T01');
  assert.equal(Math.round(c.custo_total * 100) / 100, 340); // 100 kg x R$ 3,40
  assert.equal(c.por_categoria[0].categoria, 'fertilizante');
});

test('produtividade média por cultura ($avg)', async () => {
  const [p] = await rel.produtividadePorCultura();
  assert.equal(p._id, 'soja');
  assert.equal(p.media_sc_ha, 63);
  assert.equal(p.colheitas, 2);
});

test('insumos abaixo do mínimo ($expr)', async () => {
  const baixos = await insumosRepo.listarInsumosAbaixoDoMinimo();
  assert.equal(baixos.length, 1);
  assert.equal(await insumosRepo.contarInsumosAbaixoDoMinimo(), 1);
  assert.equal((await rel.insumosAbaixoDoMinimoAgregado())[0].falta, 200);
});

test('todas as telas respondem 200', async () => {
  for (const rota of ['/', '/talhoes', '/talhoes/novo', '/insumos', '/insumos/novo', '/relatorios', '/banco']) {
    assert.equal((await request(app).get(rota)).status, 200, rota);
  }
});

test('o banco recusa documento fora do validador $jsonSchema (erro 121)', async () => {
  await assert.rejects(
    h.getDb().collection('talhoes').insertOne({ codigo: 'ZZ', nome: 'x', cultura: 'arroz', area_ha: -1, safra: 'x', status: 'y', operacoes: [] }),
    (e) => e.code === 121,
  );
});
