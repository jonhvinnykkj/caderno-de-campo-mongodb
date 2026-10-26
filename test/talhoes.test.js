const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const h = require('./auxiliar');

let app;
before(async () => { await h.preparar(); app = h.criarApp(); });
after(h.fechar);
beforeEach(h.limpar);

const form = { codigo: 'T09', nome: 'Talhão Novo', cultura: 'soja', variedade: 'Brasmax', area_ha: '12,5', safra: '2026/27', status: 'planejado', tags: 'irrigado, plantio direto' };

test('cria talhão e grava área com vírgula e tags em array', async () => {
  const res = await request(app).post('/talhoes').type('form').send(form);
  assert.equal(res.status, 302);
  const doc = await h.getDb().collection('talhoes').findOne({ codigo: 'T09' });
  assert.equal(doc.area_ha, 12.5);
  assert.deepEqual(doc.tags, ['irrigado', 'plantio direto']);
  assert.deepEqual(doc.operacoes, []);
});

test('depois de criar, a página seguinte mostra a faixa de confirmação uma vez só', async () => {
  const res = await request(app).post('/talhoes').type('form').send(form);
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('aviso=')).split(';')[0];
  const pagina = await request(app).get(res.headers.location).set('Cookie', cookie);
  assert.match(pagina.text, /class="faixa ok"[\s\S]*Talhão T09 criado/);
  assert.ok(pagina.headers['set-cookie'].some((c) => c.startsWith('aviso=;')), 'o cookie do aviso é apagado ao exibir');
});

test('recusa código duplicado com mensagem clara e mantém o digitado', async () => {
  await h.inserirTalhao({ codigo: 'T09' });
  const res = await request(app).post('/talhoes').type('form').send(form);
  assert.equal(res.status, 422);
  assert.match(res.text, /Já existe um talhão com o código T09/);
  assert.match(res.text, /value="Talhão Novo"/);
});

test('validação do formulário mostra erros ao lado dos campos', async () => {
  const res = await request(app).post('/talhoes').type('form').send({ ...form, codigo: 'X1', area_ha: '-3', safra: '26', cultura: 'arroz' });
  assert.equal(res.status, 422);
  assert.match(res.text, /Use a letra T e dois dígitos/);
  assert.match(res.text, /área maior que zero/);
  assert.match(res.text, /AAAA\/AA/);
  assert.match(res.text, /Escolha uma cultura/);
  assert.equal(await h.getDb().collection('talhoes').countDocuments(), 0);
});

test('lê, edita e exclui talhão', async () => {
  const t = await h.inserirTalhao();
  assert.equal((await request(app).get(`/talhoes/${t._id}`)).status, 200);
  const edit = await request(app).post(`/talhoes/${t._id}`).type('form').send({ ...form, codigo: 'T01', nome: 'Nome Editado' });
  assert.equal(edit.status, 302);
  assert.equal((await h.talhaoDe(t._id)).nome, 'Nome Editado');
  assert.equal((await request(app).get(`/talhoes/${t._id}/excluir`)).status, 200);
  await request(app).post(`/talhoes/${t._id}/excluir`).expect(302);
  assert.equal(await h.talhaoDe(t._id), null);
});

test('id inexistente ou inválido devolve 404', async () => {
  assert.equal((await request(app).get('/talhoes/abc')).status, 404);
  assert.equal((await request(app).get('/talhoes/64b7f0f0f0f0f0f0f0f0f0f0')).status, 404);
  assert.equal((await request(app).get('/rota-que-nao-existe')).status, 404);
});

test('busca textual, filtro por cultura e paginação', async () => {
  await h.inserirTalhao({ codigo: 'T01', nome: 'Baixada', tags: ['irrigado'] });
  await h.inserirTalhao({ codigo: 'T02', nome: 'Mata Velha', cultura: 'soja', variedade: 'Brasmax', tags: [] });
  for (let i = 3; i <= 11; i++) await h.inserirTalhao({ codigo: `T${String(i).padStart(2, '0')}`, nome: `Gleba ${i}`, cultura: 'milho', tags: [] });
  const busca = await request(app).get('/talhoes?q=brasmax');
  assert.match(busca.text, /Mata Velha/);
  assert.doesNotMatch(busca.text, /Baixada/);
  const milho = await request(app).get('/talhoes?cultura=milho');
  assert.match(milho.text, /Gleba 3/);
  assert.doesNotMatch(milho.text, /Mata Velha/);
  const p1 = await request(app).get('/talhoes');
  const p2 = await request(app).get('/talhoes?pagina=2');
  assert.match(p1.text, /Página 1 de 2/);
  assert.match(p2.text, /Gleba 10/);
  assert.doesNotMatch(p2.text, /T01/);
});
