const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const h = require('./auxiliar');

let app, ins, talhao;
before(async () => { await h.preparar(); app = h.criarApp(); });
after(h.fechar);
beforeEach(async () => {
  await h.limpar();
  ins = await h.inserirInsumo({ estoque: 1000 });
  talhao = await h.inserirTalhao({ area_ha: 10 });
});

const op = (extra = {}) => ({ tipo: 'adubação', data: '2026-10-01', insumo_id: String(ins._id), dose_por_ha: '50', responsavel: 'João', observacao: '', ...extra });
const registrar = (extra) => request(app).post(`/talhoes/${talhao._id}/operacoes`).type('form').send(op(extra));

test('registrar operação: $push no talhão, total calculado e estoque baixado', async () => {
  await registrar().expect(302);
  const t = await h.talhaoDe(talhao._id);
  assert.equal(t.operacoes.length, 1);
  assert.equal(t.operacoes[0].quantidade_total, 500);
  assert.equal(t.operacoes[0].insumo.nome, 'Ureia 45% N');
  assert.equal(t.operacoes[0].insumo.preco_unitario, 3.4);
  assert.equal(await h.estoqueDe(ins._id), 500);
});

test('recusa estoque insuficiente e não grava nada', async () => {
  const res = await registrar({ dose_por_ha: '150' }); // 1500 > 1000
  assert.equal(res.status, 422);
  assert.match(res.text, /Estoque insuficiente/);
  assert.equal((await h.talhaoDe(talhao._id)).operacoes.length, 0);
  assert.equal(await h.estoqueDe(ins._id), 1000);
});

test('validação: dose obrigatória com insumo e produtividade na colheita', async () => {
  const sem = await registrar({ dose_por_ha: '' });
  assert.equal(sem.status, 422);
  assert.match(sem.text, /dose por hectare/);
  const col = await registrar({ tipo: 'colheita', insumo_id: '', dose_por_ha: '' });
  assert.equal(col.status, 422);
  assert.match(col.text, /produtividade em sc\/ha/);
});

test('colheita sem insumo guarda produtividade e não mexe no estoque', async () => {
  await registrar({ tipo: 'colheita', insumo_id: '', dose_por_ha: '', produtividade_sc_ha: '63,5' }).expect(302);
  const o = (await h.talhaoDe(talhao._id)).operacoes[0];
  assert.equal(o.produtividade_sc_ha, 63.5);
  assert.equal(o.insumo, null);
  assert.equal(await h.estoqueDe(ins._id), 1000);
});

test('editar operação acerta a diferença de estoque (arrayFilters)', async () => {
  await registrar().expect(302);
  const id = (await h.talhaoDe(talhao._id)).operacoes[0]._id;
  await request(app).post(`/talhoes/${talhao._id}/operacoes/${id}`).type('form').send(op({ dose_por_ha: '80', observacao: 'ajustada' })).expect(302);
  const o = (await h.talhaoDe(talhao._id)).operacoes[0];
  assert.equal(o.quantidade_total, 800);
  assert.equal(o.observacao, 'ajustada');
  assert.equal(await h.estoqueDe(ins._id), 200);
  await request(app).post(`/talhoes/${talhao._id}/operacoes/${id}`).type('form').send(op({ dose_por_ha: '20' })).expect(302);
  assert.equal(await h.estoqueDe(ins._id), 800);
});

test('editar para dose acima do saldo é recusado e preserva tudo', async () => {
  await registrar().expect(302);
  const id = (await h.talhaoDe(talhao._id)).operacoes[0]._id;
  const res = await request(app).post(`/talhoes/${talhao._id}/operacoes/${id}`).type('form').send(op({ dose_por_ha: '200' }));
  assert.equal(res.status, 422);
  assert.equal(await h.estoqueDe(ins._id), 500);
  assert.equal((await h.talhaoDe(talhao._id)).operacoes[0].quantidade_total, 500);
});

test('editar trocando de insumo devolve o antigo e baixa o novo', async () => {
  const outro = await h.inserirInsumo({ nome: 'Formulado NPK', estoque: 2000 });
  await registrar().expect(302);
  const id = (await h.talhaoDe(talhao._id)).operacoes[0]._id;
  await request(app).post(`/talhoes/${talhao._id}/operacoes/${id}`).type('form').send(op({ insumo_id: String(outro._id), dose_por_ha: '100' })).expect(302);
  assert.equal(await h.estoqueDe(ins._id), 1000);
  assert.equal(await h.estoqueDe(outro._id), 1000);
});

test('excluir operação devolve o estoque ($pull + $inc)', async () => {
  await registrar().expect(302);
  const id = (await h.talhaoDe(talhao._id)).operacoes[0]._id;
  await request(app).post(`/talhoes/${talhao._id}/operacoes/${id}/excluir`).expect(302);
  assert.equal((await h.talhaoDe(talhao._id)).operacoes.length, 0);
  assert.equal(await h.estoqueDe(ins._id), 1000);
});

test('excluir talhão devolve ao estoque os insumos de todas as operações', async () => {
  await registrar().expect(302);
  await registrar({ dose_por_ha: '30' }).expect(302);
  assert.equal(await h.estoqueDe(ins._id), 200);
  await request(app).post(`/talhoes/${talhao._id}/excluir`).expect(302);
  assert.equal(await h.talhaoDe(talhao._id), null);
  assert.equal(await h.estoqueDe(ins._id), 1000);
});

test('a ficha mostra o documento do MongoDB e as operações', async () => {
  await registrar().expect(302);
  const res = await request(app).get(`/talhoes/${talhao._id}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /Documento no MongoDB/);
  assert.match(res.text, /quantidade_total/);
  assert.match(res.text, /Ureia 45% N/);
});
