const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const h = require('./auxiliar');

let app;
before(async () => { await h.preparar(); app = h.criarApp(); });
after(h.fechar);
beforeEach(h.limpar);

const form = { nome: 'Calcário', categoria: 'corretivo', fabricante: '', unidade: 'kg', estoque: '5000', estoque_minimo: '1000', preco_unitario: '0,28' };

test('cria, edita e exclui insumo', async () => {
  await request(app).post('/insumos').type('form').send(form).expect(302);
  const doc = await h.getDb().collection('insumos').findOne({ nome: 'Calcário' });
  assert.equal(doc.preco_unitario, 0.28);
  assert.equal(doc.fabricante, undefined);
  await request(app).post(`/insumos/${doc._id}`).type('form').send({ ...form, estoque: '4000', fabricante: 'Mineradora' }).expect(302);
  const editado = await h.getDb().collection('insumos').findOne({ _id: doc._id });
  assert.equal(editado.estoque, 4000);
  assert.equal(editado.fabricante, 'Mineradora');
  await request(app).post(`/insumos/${doc._id}/excluir`).expect(302);
  assert.equal(await h.getDb().collection('insumos').countDocuments(), 0);
});

test('validação recusa dados inválidos', async () => {
  const res = await request(app).post('/insumos').type('form').send({ ...form, nome: 'A', categoria: 'x', unidade: 'g', estoque: '-1' });
  assert.equal(res.status, 422);
  assert.match(res.text, /2 a 80 caracteres/);
  assert.match(res.text, /Escolha uma categoria/);
  assert.match(res.text, /Escolha kg, L ou sc/);
  assert.match(res.text, /maior ou igual a zero/);
});

test('recusa excluir insumo em uso e informa quantos talhões usam', async () => {
  const ins = await h.inserirInsumo();
  const t = await h.inserirTalhao();
  await request(app).post(`/talhoes/${t._id}/operacoes`).type('form')
    .send({ tipo: 'adubação', data: '2026-10-01', insumo_id: String(ins._id), dose_por_ha: '50', responsavel: 'João' }).expect(302);
  const res = await request(app).post(`/insumos/${ins._id}/excluir`);
  assert.equal(res.status, 409);
  assert.match(res.text, /usado em operações de 1 talhão/);
  assert.equal(await h.getDb().collection('insumos').countDocuments(), 1);
});

test('filtros: estoque baixo, categoria e busca textual', async () => {
  await h.inserirInsumo({ nome: 'Ureia 45% N', estoque: 100 });
  await h.inserirInsumo({ nome: 'Engeo Pleno S', categoria: 'defensivo', fabricante: 'Syngenta', unidade: 'L', estoque: 50, estoque_minimo: 10 });
  const baixo = await request(app).get('/insumos?baixo=1');
  assert.match(baixo.text, /Ureia/);
  assert.doesNotMatch(baixo.text, /Engeo/);
  const cat = await request(app).get('/insumos?categoria=defensivo');
  assert.match(cat.text, /Engeo/);
  assert.doesNotMatch(cat.text, /Ureia/);
  const q = await request(app).get('/insumos?q=syngenta');
  assert.match(q.text, /Engeo/);
  assert.doesNotMatch(q.text, /Ureia/);
});
