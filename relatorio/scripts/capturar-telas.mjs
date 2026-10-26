// Captura as telas da aplicação e do mongo-express com Playwright (Chromium headless).
// Pré-requisito: banco com o seed, app em URL_APP e mongo-express em URL_MONGO_EXPRESS.
// Os fluxos que criam dados usam o talhão de demonstração T98 e o excluem no fim.
// No fim confere se o banco ficou igual ao início (contagens e estoque); se não, roda `npm run db:seed`.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PRINTS, URL_APP, URL_MONGO_EXPRESS, URI_MONGO, MONGOSH, RAIZ_PROJETO } from './config.mjs';

const CODIGO_DEMO = 'T98';
const ALTURA_PARTE = 1150; // páginas mais altas que isso viram várias figuras
fs.mkdirSync(PRINTS, { recursive: true });

const falhas = [];
const feitos = [];

function mongosh(js) {
  return execFileSync(MONGOSH, [URI_MONGO, '--quiet', '--eval', js], { encoding: 'utf8' }).trim();
}

// Foto do banco: contagens e estoque de cada insumo.
function estadoBanco() {
  return mongosh(`print(JSON.stringify({
    talhoes: db.talhoes.countDocuments(), insumos: db.insumos.countDocuments(),
    operacoes: db.talhoes.aggregate([{ $unwind: "$operacoes" }, { $count: "n" }]).toArray()[0]?.n,
    estoque: db.insumos.find({}, { nome: 1, estoque: 1 }).sort({ nome: 1 }).toArray().map(i => [i.nome, i.estoque]) }))`);
}

// Rede de segurança: devolve ao estoque o que o talhão de demonstração gastou e apaga o talhão.
function limparDemo() {
  mongosh(`
    const t = db.talhoes.findOne({ codigo: "${CODIGO_DEMO}" });
    if (t) {
      (t.operacoes || []).forEach(op => {
        if (op.insumo && op.quantidade_total) db.insumos.updateOne({ _id: op.insumo._id }, { $inc: { estoque: op.quantidade_total } });
      });
      db.talhoes.deleteOne({ _id: t._id });
    }`);
}

const hex = (texto) => /[0-9a-f]{24}/.exec(texto)?.[0] ?? null;
const idTalhao = (codigo) => hex(mongosh(`const t = db.talhoes.findOne({ codigo: "${codigo}" }); print(t ? t._id.toString() : "")`));
const idPrimeiraOperacao = (codigo) => hex(mongosh(`const t = db.talhoes.findOne({ codigo: "${codigo}" }); print(t && t.operacoes[0] ? t.operacoes[0]._id.toString() : "")`));

// Executa um passo isolado: se falhar, registra e segue para o próximo.
async function passo(nome, fn) {
  try {
    await fn();
    feitos.push(nome);
    console.log('ok   ', nome);
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message.split('\n')[0]}`);
    console.log('FALHA', nome, '-', erro.message.split('\n')[0]);
  }
}

async function aguardar(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
}

// Foto da tela. Com `recorte`, tira a barra lateral e corta o vazio abaixo do conteúdo (o texto fica maior no A4).
async function foto(page, arquivo, { inteira = false, recorte = false, maxAltura = null } = {}) {
  await aguardar(page);
  const destino = path.join(PRINTS, arquivo);
  if (!recorte) return page.screenshot({ path: destino, fullPage: inteira });
  const medidas = await page.evaluate(() => {
    const lateral = document.querySelector('aside.lateral');
    const x = lateral ? Math.ceil(lateral.getBoundingClientRect().width) : 0;
    const filhos = [...document.querySelectorAll('main > *')];
    const fundo = Math.max(0, ...filhos.map(e => e.getBoundingClientRect().bottom + window.scrollY));
    return { x, fundo, total: document.documentElement.scrollHeight };
  });
  const base = inteira ? Math.min(medidas.total, medidas.fundo + 32) : Math.min(900, medidas.fundo + 32);
  const altura = Math.max(320, maxAltura ? Math.min(maxAltura, base) : base);
  await page.screenshot({ path: destino, fullPage: true, clip: { x: medidas.x, y: 0, width: 1440 - medidas.x, height: altura } });
}

// Página inteira dividida em partes de até ALTURA_PARTE px (arquivo-1.png, arquivo-2.png...).
async function fotoPartes(page, base) {
  await aguardar(page);
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  const n = Math.max(1, Math.ceil(altura / ALTURA_PARTE));
  const h = Math.ceil(altura / n);
  for (let i = 0; i < n; i++) {
    await page.screenshot({
      path: path.join(PRINTS, `${base}-${i + 1}.png`), fullPage: true,
      clip: { x: 0, y: i * h, width: 1440, height: Math.min(h, altura - i * h) },
    });
  }
  console.log(`      ${base}: ${altura}px em ${n} parte(s)`);
}

// Preenche um campo pelo atributo name (input, textarea ou select; no select casa pelo trecho do texto).
async function preencher(page, nome, valor) {
  const campo = page.locator(`[name="${nome}"]`).first();
  const tag = await campo.evaluate(el => el.tagName.toLowerCase());
  if (tag === 'select') {
    const opcoes = await campo.locator('option').evaluateAll(os => os.map(o => ({ v: o.value, t: o.textContent.trim() })));
    const achada = opcoes.find(o => o.v === String(valor)) ?? opcoes.find(o => o.t.toLowerCase().includes(String(valor).toLowerCase()));
    if (!achada) throw new Error(`opção "${valor}" não existe em ${nome}`);
    await campo.selectOption(achada.v);
  } else await campo.fill(String(valor));
}

async function enviar(page, seletor = 'main form button[type="submit"]') {
  await page.locator(seletor).first().click();
  await aguardar(page);
}

const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // aaaa-mm-dd

limparDemo();
const antes = estadoBanco();
console.log('Banco antes:', antes.slice(0, 90) + '...');

const navegador = await chromium.launch({ headless: true, args: ['--lang=pt-BR'] });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await contexto.newPage();
const ir = (rota) => page.goto(URL_APP + rota, { waitUntil: 'networkidle' });

// --- Aplicação ---
await passo('painel', async () => { await ir('/'); await foto(page, '01-painel.png', { inteira: true }); });
await passo('lista de talhões', async () => { await ir('/talhoes'); await foto(page, '02-talhoes-lista.png'); });
await passo('filtro', async () => { await ir('/talhoes?cultura=amendoim'); await foto(page, '03-talhoes-filtro.png', { recorte: true }); });
await passo('busca', async () => { await ir('/talhoes?q=irrigado'); await foto(page, '04-talhoes-busca.png', { recorte: true }); });
await passo('novo talhão vazio', async () => { await ir('/talhoes/novo'); await foto(page, '05-talhao-novo-vazio.png', { recorte: true }); });

await passo('erro de validação', async () => {
  await ir('/talhoes/novo');
  await preencher(page, 'codigo', 'X1');
  await preencher(page, 'nome', 'A');
  await preencher(page, 'area_ha', '-3');
  await preencher(page, 'safra', '2026');
  await enviar(page);
  await foto(page, '06-talhao-erro.png', { recorte: true });
});

await passo('novo talhão preenchido e criado', async () => {
  await ir('/talhoes/novo');
  await preencher(page, 'codigo', CODIGO_DEMO);
  await preencher(page, 'nome', 'Talhão de demonstração');
  await preencher(page, 'cultura', 'milho');
  await preencher(page, 'variedade', 'AG 8088');
  await preencher(page, 'area_ha', '12,5');
  await preencher(page, 'safra', '2026/27');
  await preencher(page, 'status', 'em andamento');
  await preencher(page, 'tags', 'irrigado, plantio direto');
  await foto(page, '07-talhao-preenchido.png', { recorte: true });
  await enviar(page);
  await foto(page, '08-talhao-criado.png', { recorte: true }); // faixa de sucesso (cookie de leitura única)
});

const id = idTalhao(CODIGO_DEMO);

await passo('ficha do talhão (T01) e documento', async () => {
  const t01 = idTalhao('T01');
  await ir(`/talhoes/${t01}`);
  await foto(page, '09-talhao-ficha.png', { inteira: true, recorte: true });
  const bloco = page.locator('details.documento').first();
  await bloco.evaluate(el => { el.open = true; });
  await bloco.scrollIntoViewIfNeeded();
  const caixa = await bloco.boundingBox(); // o JSON é longo: só as primeiras linhas
  await page.screenshot({ path: path.join(PRINTS, '12-talhao-documento.png'), fullPage: true, clip: { x: caixa.x, y: caixa.y + await page.evaluate(() => window.scrollY), width: caixa.width, height: Math.min(caixa.height, 620) } });
});

await passo('registrar operação', async () => {
  if (!id) throw new Error('talhão de demonstração não foi criado');
  await ir(`/talhoes/${id}`);
  const form = 'form[action$="/operacoes"]';
  await preencher(page, 'tipo', 'adubação');
  await preencher(page, 'data', hoje);
  await preencher(page, 'insumo_id', 'Ureia');
  await preencher(page, 'dose_por_ha', '100');
  await preencher(page, 'responsavel', 'João');
  await preencher(page, 'observacao', 'Adubação de cobertura (demonstração)');
  await foto(page, '10-operacao-registrar.png', { recorte: true });
  await enviar(page, `${form} button[type="submit"]`);
  await foto(page, '11-operacao-registrada.png', { inteira: true, recorte: true });
});

const idOp = idPrimeiraOperacao(CODIGO_DEMO);

await passo('editar operação', async () => {
  if (!id || !idOp) throw new Error('sem operação de demonstração');
  await ir(`/talhoes/${id}/operacoes/${idOp}/editar`);
  await preencher(page, 'dose_por_ha', '120');
  await foto(page, '21-operacao-editar.png', { recorte: true });
});

await passo('confirmar exclusão da operação', async () => {
  if (!id || !idOp) throw new Error('sem operação de demonstração');
  await ir(`/talhoes/${id}/operacoes/${idOp}/excluir`);
  await foto(page, '22-operacao-excluir.png', { recorte: true });
  await enviar(page); // exclui de verdade e devolve o estoque
});

await passo('editar talhão', async () => {
  if (!id) throw new Error('sem id');
  await ir(`/talhoes/${id}/editar`);
  await foto(page, '13-talhao-editar.png', { recorte: true });
});

await passo('confirmar exclusão do talhão', async () => {
  if (!id) throw new Error('sem id');
  await ir(`/talhoes/${id}/excluir`);
  await foto(page, '14-talhao-excluir.png', { recorte: true });
  await enviar(page);
});

await passo('insumos', async () => { await ir('/insumos'); await foto(page, '15-insumos.png', { inteira: true, recorte: true }); });
await passo('insumos com estoque baixo', async () => { await ir('/insumos?baixo=1'); await foto(page, '16-insumos-baixo.png', { recorte: true }); });

await passo('insumo em uso (recusa)', async () => {
  await ir('/insumos?q=ureia');
  await page.locator('a[href$="/excluir"]').first().click();
  await aguardar(page);
  await enviar(page); // POST: o app recusa porque há operações usando o insumo
  await foto(page, '17-insumo-em-uso.png', { recorte: true });
});

await passo('relatórios', async () => {
  await ir('/relatorios');
  await page.locator('details.pipeline').nth(1).evaluate(d => { d.open = true; }); // pipeline de operações por tipo (curto)
  await aguardar(page);
  // duas figuras: o custo por talhão (com $lookup) e, abaixo, operações por tipo com o pipeline aberto
  const corte = await page.evaluate(() => {
    const h = [...document.querySelectorAll('main h2')].find(e => /Operações por tipo/i.test(e.textContent));
    return Math.floor(h.getBoundingClientRect().top + window.scrollY) - 16;
  });
  const lateral = await page.evaluate(() => Math.ceil(document.querySelector('aside.lateral').getBoundingClientRect().width));
  const total = await page.evaluate(() => Math.max(...[...document.querySelectorAll('main > *')].map(e => e.getBoundingClientRect().bottom + window.scrollY)) + 32);
  const faixa = (arquivo, y0, y1) => page.screenshot({ path: path.join(PRINTS, arquivo), fullPage: true, clip: { x: lateral, y: y0, width: 1440 - lateral, height: y1 - y0 } });
  await faixa('18-relatorios-1.png', 0, corte);
  await faixa('18-relatorios-2.png', corte, total);
});

await passo('banco de dados', async () => {
  await ir('/banco');
  await foto(page, '20-banco-app-1.png', { recorte: true }); // coleção talhoes: contagem, tamanho, índices
  await page.getByText('caderno_de_campo.insumos').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -20));
  await foto(page, '20-banco-app-2.png', { recorte: true }); // coleção insumos
});

await passo('celular', async () => {
  const cel = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await cel.newPage();
  await p.goto(URL_APP + '/talhoes', { waitUntil: 'networkidle' });
  await p.screenshot({ path: path.join(PRINTS, '19-celular.png') });
  await cel.close();
});

// --- mongo-express ---
const me = (rota) => page.goto(URL_MONGO_EXPRESS + rota, { waitUntil: 'networkidle' });
// Recorta a figura ao contêiner do mongo-express (a página tem muito branco à direita) e limita a altura.
async function fotoMe(arquivo, altura) {
  await aguardar(page);
  const caixa = await page.locator('.container').first().boundingBox();
  const x = Math.max(0, Math.floor(caixa.x) - 12);
  await page.screenshot({ path: path.join(PRINTS, arquivo), clip: { x, y: 0, width: Math.min(1440 - x, Math.ceil(caixa.width) + 24), height: altura } });
}
await passo('mongo-express: bancos', async () => { await me('/'); await fotoMe('me-1-bancos.png', 620); });
await passo('mongo-express: banco', async () => { await me('/db/caderno_de_campo'); await fotoMe('me-2-banco.png', 460); });
await passo('mongo-express: talhoes', async () => { await me('/db/caderno_de_campo/talhoes'); await fotoMe('me-3-talhoes.png', 760); });
await passo('mongo-express: documento', async () => {
  const t01 = idTalhao('T01');
  await me(`/db/caderno_de_campo/talhoes/%22${t01}%22?skip=0`);
  await fotoMe('me-4-documento.png', 820);
});
await passo('mongo-express: insumos', async () => { await me('/db/caderno_de_campo/insumos'); await fotoMe('me-5-insumos.png', 760); });

await navegador.close();

// Conferência final: o banco precisa estar como o seed deixou.
limparDemo();
let depois = estadoBanco();
if (depois !== antes) {
  console.log('Banco diferente do início; rodando npm run db:seed.');
  execFileSync('npm', ['run', 'db:seed'], { cwd: RAIZ_PROJETO, stdio: 'inherit' });
  depois = estadoBanco();
}
console.log(depois === antes ? 'Banco conferido: igual ao início.' : 'ATENÇÃO: banco diferente do início (confira).');
console.log(`\n${feitos.length} passos ok, ${falhas.length} com falha.`);
falhas.forEach(f => console.log(' -', f));
process.exit(falhas.length ? 1 : 0);
