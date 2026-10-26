// Monta o HTML final do relatório (template + figuras + sumário) e gera o PDF com Playwright.
// Faz duas passagens: a primeira descobre em que página cada título caiu; a segunda preenche o sumário.
// Figuras sem imagem viram um quadro cinza provisório (útil para validar a diagramação).
import { chromium } from 'playwright';
import { codeToHtml } from 'shiki';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_PROJETO, RAIZ_RELATORIO, SAIDA, PRINTS, CODIGO, COMANDOS, PDF, LINK_GITHUB } from './config.mjs';
import { TELAS, BANCO } from './figuras.mjs';

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const desescapar = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const lerJson = (caminho, padrao) => (fs.existsSync(caminho) ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : padrao);

let provisorias = 0;

function figura({ pasta, arquivo, legenda, texto, classe = '' }) {
  const existe = fs.existsSync(path.join(SAIDA, pasta, arquivo));
  let miolo;
  if (existe) miolo = `<img src="${pasta}/${arquivo}" alt="${escapar(legenda)}">`;
  else { provisorias++; miolo = `<div class="ph">[provisório] ${escapar(arquivo)}<br>${escapar(legenda)}</div>`; }
  return `<figure class="${classe}">${miolo}<figcaption><b>${escapar(legenda)}.</b> ${escapar(texto)}</figcaption></figure>`;
}

function figurasTelas(lista) {
  return lista.map(f => figura({ pasta: 'prints', arquivo: f.arquivo, legenda: f.legenda, texto: f.texto, classe: f.retrato ? 'retrato' : '' })).join('\n');
}

function figurasCodigo() {
  let itens = lerJson(path.join(CODIGO, 'manifesto.json'), null);
  if (!itens) {
    const cfg = lerJson(path.join(RAIZ_RELATORIO, 'trechos.json'), { trechos: [] });
    itens = cfg.trechos.map(t => ({ arquivo: `codigo-${t.id}.png`, legenda: t.titulo, texto: `Arquivo ${t.arquivo}, linhas ${t.inicio} a ${t.fim}.` }));
  }
  return itens.map(f => figura({ pasta: 'codigo', ...f, classe: 'codigo-fig' })).join('\n');
}

function figurasComandos() {
  let itens = lerJson(path.join(COMANDOS, 'manifesto.json'), null);
  if (!itens) { // provisório: títulos tirados do próprio script de demonstração
    const script = fs.readFileSync(path.join(RAIZ_PROJETO, 'docs', 'comandos-mongosh.js'), 'utf8');
    itens = [...script.matchAll(/secao\("(\d+)\. ([^"]+)"\)/g)].map(m => ({ n: m[1], titulo: m[2], arquivos: [`comandos-${m[1].padStart(2, '0')}.png`] }));
  }
  const figs = [];
  for (const it of itens) {
    it.arquivos.forEach((arquivo, i) => figs.push(figura({
      pasta: 'comandos', arquivo, classe: 'comando-fig',
      legenda: `mongosh: ${it.titulo.replace(/^./, c => c.toLowerCase())}${it.arquivos.length > 1 ? ` (parte ${i + 1} de ${it.arquivos.length})` : ''}`,
      texto: `Trecho ${it.n} do script e a saída devolvida pelo MongoDB.`,
    })));
  }
  return figs.join('\n');
}

function tabelaIntegrantes() {
  const lista = lerJson(path.join(RAIZ_RELATORIO, 'integrantes.json'), []);
  const linhas = lista.map(i => {
    const pend = (v) => (/A PREENCHER/.test(v) ? ' class="pendente"' : '');
    return `<tr><td${pend(i.nome)}>${escapar(i.nome)}</td><td${pend(i.ra)}>${escapar(i.ra)}</td></tr>`;
  }).join('');
  return `<table class="ident"><tr><th>Nome</th><th style="width:3.2cm">RA</th></tr>${linhas}</table>`;
}

async function colorirCodigo(html) {
  const re = /<pre class="codigo" data-lang="(\w+)">([\s\S]*?)<\/pre>/g;
  const achados = [...html.matchAll(re)];
  for (const m of achados) {
    const colorido = await codeToHtml(desescapar(m[2]), { lang: m[1], theme: 'github-light' });
    html = html.replace(m[0], colorido.replace('<pre class="shiki', '<pre class="codigo shiki'));
  }
  return html;
}

// Dá id aos h2 e devolve a lista de títulos para o sumário.
function prepararTitulos(html) {
  let n = 0;
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, t) => `<h2 id="h2-${++n}">${t}</h2>`);
  const titulos = [...html.matchAll(/<h([12]) (?:class="[^"]*" )?id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map(m => ({ nivel: Number(m[1]), id: m[2], texto: m[3].replace(/<[^>]+>/g, '') }));
  return { html, titulos };
}

function sumario(titulos, paginas) {
  const itens = titulos.map(t => `<li class="n${t.nivel}"><span>${escapar(t.texto)}</span><span class="pontos"></span><span class="pg">${paginas[t.id] ?? ''}</span></li>`).join('');
  return `<ol>${itens}</ol>`;
}

async function montar(paginas) {
  const raiz = path.join(RAIZ_RELATORIO, 'modelo');
  let html = fs.readFileSync(path.join(raiz, 'relatorio.html'), 'utf8');
  const css = fs.readFileSync(path.join(raiz, 'relatorio.css'), 'utf8');
  provisorias = 0;
  html = html.replace('/*CSS*/', css)
    .replace('<!-- INTEGRANTES -->', tabelaIntegrantes())
    .replace('<!-- FIGURAS:telas -->', figurasTelas(TELAS))
    .replace('<!-- FIGURAS:codigo -->', figurasCodigo())
    .replace('<!-- FIGURAS:comandos -->', figurasComandos())
    .replace('<!-- FIGURAS:banco -->', figurasTelas(BANCO))
    .replaceAll('{{GITHUB}}', LINK_GITHUB);
  html = await colorirCodigo(html);
  const { html: comIds, titulos } = prepararTitulos(html);
  return { html: comIds.replace('<!-- SUMARIO -->', sumario(titulos, paginas)), titulos };
}

async function renderizar(page, html) {
  const arquivoHtml = path.join(SAIDA, 'relatorio.html');
  fs.writeFileSync(arquivoHtml, html);
  await page.goto('file://' + arquivoHtml, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true });
}

// Procura em qual página (do PDF) cada título caiu, lendo o texto de cada página.
function descobrirPaginas(titulos) {
  const info = execFileSync('pdfinfo', [PDF], { encoding: 'utf8' });
  const total = Number(/Pages:\s+(\d+)/.exec(info)[1]);
  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const textos = [];
  for (let p = 1; p <= total; p++) textos.push(norm(execFileSync('pdftotext', ['-f', String(p), '-l', String(p), PDF, '-'], { encoding: 'utf8' }).replace(/\n+/g, ' ')));
  const paginas = {};
  let a_partir = 3; // pula capa e sumário
  for (const t of titulos) {
    const alvo = norm(t.texto);
    for (let p = a_partir; p <= total; p++) {
      if (textos[p - 1].includes(alvo)) { paginas[t.id] = p; a_partir = p; break; }
    }
  }
  return { paginas, total };
}

fs.mkdirSync(SAIDA, { recursive: true });
const navegador = await chromium.launch({ headless: true });
const page = await navegador.newPage();

const primeira = await montar({});
await renderizar(page, primeira.html);
const { paginas } = descobrirPaginas(primeira.titulos);

const segunda = await montar(paginas);
await renderizar(page, segunda.html);
const { total } = descobrirPaginas(segunda.titulos);
await navegador.close();

console.log(`PDF: ${PDF}\n${total} páginas; ${provisorias} figuras provisórias.`);
