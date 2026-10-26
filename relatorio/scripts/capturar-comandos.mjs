// Roda docs/comandos-mongosh.js no mongosh, guarda a saída bruta e gera uma imagem de terminal por seção.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_PROJETO, SAIDA, COMANDOS, URI_MONGO, MONGOSH } from './config.mjs';

const MAX_LINHAS = 36; // acima disso a seção continua em outra imagem
const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

fs.mkdirSync(COMANDOS, { recursive: true });
for (const f of fs.readdirSync(COMANDOS)) fs.rmSync(path.join(COMANDOS, f));

const saida = execFileSync(MONGOSH, [URI_MONGO, '--quiet', 'docs/comandos-mongosh.js'], {
  cwd: RAIZ_PROJETO, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, maxBuffer: 20 * 1024 * 1024,
});
fs.writeFileSync(path.join(SAIDA, 'mongosh.txt'), saida);

// Quebra em seções pelas linhas "== N. título ==".
const secoes = [];
for (const linha of saida.split('\n')) {
  const m = /^== (\d+)\. (.+) ==$/.exec(linha);
  if (m) secoes.push({ n: m[1], titulo: m[2], linhas: [] });
  else if (secoes.length) secoes.at(-1).linhas.push(linha);
}

const comandoShell = 'mongosh "mongodb://127.0.0.1:27029/caderno_de_campo" docs/comandos-mongosh.js';
const navegador = await chromium.launch({ headless: true });
const page = await navegador.newPage({ viewport: { width: 780, height: 600 }, deviceScaleFactor: 2 });
const manifesto = [];

for (const s of secoes) {
  while (s.linhas.length && !s.linhas.at(-1).trim()) s.linhas.pop();
  const partes = [];
  for (let i = 0; i < s.linhas.length; i += MAX_LINHAS) partes.push(s.linhas.slice(i, i + MAX_LINHAS));
  const arquivos = [];
  for (const [i, parte] of partes.entries()) {
    const corpo = parte.map(l => {
      const e = escapar(l);
      return e.startsWith('caderno_de_campo&gt; ') ? `<span class="p">caderno_de_campo&gt;</span> <span class="c">${e.slice(21)}</span>` : e;
    }).join('\n');
    const sufixo = partes.length > 1 ? ` (parte ${i + 1} de ${partes.length})` : '';
    const html = `<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box} body{margin:0;background:#fff;padding:2px}
      .janela{width:740px;border:1px solid #c9ccd1;border-radius:8px;overflow:hidden;background:#fbfbfa;font-family:Menlo,Monaco,monospace}
      .topo{display:flex;align-items:center;gap:8px;background:#eceef1;border-bottom:1px solid #d0d3d8;padding:8px 12px}
      .bolas{display:flex;gap:6px}.bolas i{width:10px;height:10px;border-radius:50%;background:#c4c7cc;display:block}
      .nome{flex:1;text-align:center;font:600 12px 'Helvetica Neue',Arial,sans-serif;color:#444;margin-right:42px}
      pre{margin:0;padding:12px 16px 14px;font:12px/1.5 Menlo,Monaco,monospace;color:#1f2933;white-space:pre-wrap;overflow-wrap:anywhere}
      .sh{color:#1f2933} .sh b{color:#1f6f3a} .tit{color:#6b7280}
      .p{color:#1f6f3a;font-weight:600} .c{color:#0b4f8a}
    </style><div class="janela"><div class="topo"><div class="bolas"><i></i><i></i><i></i></div>
    <div class="nome">mongosh — caderno_de_campo</div></div>
    <pre><span class="sh"><b>$</b> ${escapar(comandoShell)}</span>\n<span class="tit">// ${s.n}. ${escapar(s.titulo)}${sufixo}</span>\n\n${corpo}</pre></div>`;
    await page.setContent(html, { waitUntil: 'load' });
    const arquivo = `comandos-${s.n.padStart(2, '0')}${partes.length > 1 ? '-' + (i + 1) : ''}.png`;
    await page.locator('.janela').screenshot({ path: path.join(COMANDOS, arquivo) });
    arquivos.push(arquivo);
  }
  manifesto.push({ n: s.n, titulo: s.titulo, arquivos });
  console.log('ok', s.n, s.titulo, arquivos.length > 1 ? `(${arquivos.length} imagens)` : '');
}

await navegador.close();
fs.writeFileSync(path.join(COMANDOS, 'manifesto.json'), JSON.stringify(manifesto, null, 2));
