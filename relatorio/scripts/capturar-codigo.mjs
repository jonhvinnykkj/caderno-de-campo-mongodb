// Gera imagens "de editor" (janela clara, números de linha, nome do arquivo) a partir de trechos reais de src/.
// Configuração: relatorio/trechos.json -> { trechos: [{ id, titulo, arquivo, inicio, fim, destaque? }] }
import { chromium } from 'playwright';
import { codeToHtml } from 'shiki';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_PROJETO, RAIZ_RELATORIO, CODIGO } from './config.mjs';

const LINGUAS = { '.js': 'javascript', '.mjs': 'javascript', '.json': 'json', '.ejs': 'html', '.css': 'css', '.yml': 'yaml', '.sh': 'bash' };
const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const config = JSON.parse(fs.readFileSync(process.env.TRECHOS || path.join(RAIZ_RELATORIO, 'trechos.json'), 'utf8'));
fs.mkdirSync(CODIGO, { recursive: true });
for (const f of fs.readdirSync(CODIGO)) fs.rmSync(path.join(CODIGO, f));

const navegador = await chromium.launch({ headless: true });
const page = await navegador.newPage({ viewport: { width: 780, height: 600 }, deviceScaleFactor: 2 });
const manifesto = [];

for (const t of config.trechos) {
  const caminho = path.join(RAIZ_PROJETO, t.arquivo);
  if (!fs.existsSync(caminho)) { console.log('FALTA', t.arquivo); continue; }
  const linhas = fs.readFileSync(caminho, 'utf8').split('\n');
  const fim = Math.min(t.fim, linhas.length);
  const codigo = linhas.slice(t.inicio - 1, fim).join('\n');
  const lang = LINGUAS[path.extname(caminho)] || 'text';
  const corpo = await codeToHtml(codigo, { lang, theme: 'github-light' });
  const destaque = (t.destaque || []).map(n => `.shiki .line:nth-child(${n - t.inicio + 1}){background:#fff8c5}`).join('');

  const html = `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;background:#fff;padding:2px}
    .janela{width:740px;border:1px solid #c9ccd1;border-radius:8px;overflow:hidden;background:#fff;font-family:Menlo,Monaco,monospace}
    .topo{display:flex;align-items:center;gap:8px;background:#eceef1;border-bottom:1px solid #d0d3d8;padding:8px 12px}
    .bolas{display:flex;gap:6px}.bolas i{width:10px;height:10px;border-radius:50%;background:#c4c7cc;display:block}
    .nome{margin-left:10px;font:600 12px 'Helvetica Neue',Arial,sans-serif;color:#333}
    .nome span{font-weight:400;color:#777;margin-left:8px}
    .codigo{padding:10px 0}
    .shiki{margin:0;background:#fff!important;font:12px/1.55 Menlo,Monaco,monospace;counter-reset:n ${t.inicio - 1};white-space:normal}
    .shiki code{display:block;white-space:normal}
    .shiki .line{display:block;white-space:pre-wrap;overflow-wrap:anywhere;padding-left:65px;text-indent:-65px;padding-right:16px;min-height:1.55em}
    .shiki .line::before{counter-increment:n;content:counter(n);display:inline-block;width:40px;padding-right:12px;margin-right:12px;text-align:right;color:#9aa0a6;border-right:1px solid #eceef1;user-select:none}
    ${destaque}
  </style><div class="janela"><div class="topo"><div class="bolas"><i></i><i></i><i></i></div>
  <div class="nome">${escapar(t.arquivo)}<span>linhas ${t.inicio}–${fim}</span></div></div>
  <div class="codigo">${corpo}</div></div>`;

  await page.setContent(html, { waitUntil: 'load' });
  const arquivo = `codigo-${t.id}.png`;
  await page.locator('.janela').screenshot({ path: path.join(CODIGO, arquivo) });
  manifesto.push({ arquivo, legenda: t.titulo, texto: t.texto || `Arquivo ${t.arquivo}, linhas ${t.inicio} a ${fim}.` });
  console.log('ok', arquivo);
}

await navegador.close();
fs.writeFileSync(path.join(CODIGO, 'manifesto.json'), JSON.stringify(manifesto, null, 2));
