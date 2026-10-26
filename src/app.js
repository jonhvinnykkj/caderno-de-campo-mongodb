// Cria o app Express (exportado para os testes; quem sobe na porta é o servidor.js).
const path = require('node:path');
const express = require('express');
const { EJSON } = require('mongodb').BSON;
const fmt = require('./formatar');
const validacao = require('./validacao');
const { ErroNegocio } = require('./erros');

const raiz = path.join(__dirname, '..');

// Aviso de uma só leitura: gravado num cookie antes do redirect e apagado ao exibir.
function lerAviso(req, res, proximo) {
  const bruto = (req.headers.cookie || '').split('; ').find((c) => c.startsWith('aviso='));
  res.locals.aviso = null;
  if (bruto) {
    try {
      res.locals.aviso = JSON.parse(decodeURIComponent(bruto.slice(6)));
    } catch {
      res.locals.aviso = null;
    }
    res.clearCookie('aviso');
  }
  proximo();
}

function classeCultura(cultura) {
  return `cultura-${String(cultura || 'pousio').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase()}`;
}

const TIPOS = {
  'preparo de solo': { icone: 'tractor', classe: 'tipo-preparo' },
  plantio: { icone: 'plant', classe: 'tipo-plantio' },
  adubação: { icone: 'grains', classe: 'tipo-adubacao' },
  pulverização: { icone: 'spray-bottle', classe: 'tipo-pulverizacao' },
  colheita: { icone: 'basket', classe: 'tipo-colheita' },
};
const tipoInfo = (tipo) => TIPOS[tipo] || { icone: 'notebook', classe: 'tipo-preparo' };

function criarApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(raiz, 'views'));
  app.disable('x-powered-by');

  // Fontes e ícones servidos direto de node_modules (funciona sem internet).
  app.use('/vendor/plex-sans', express.static(path.join(raiz, 'node_modules/@fontsource/ibm-plex-sans/files')));
  app.use('/vendor/plex-mono', express.static(path.join(raiz, 'node_modules/@fontsource/ibm-plex-mono/files')));
  app.use('/vendor/phosphor', express.static(path.join(raiz, 'node_modules/@phosphor-icons/web/src/fill')));
  app.use(express.static(path.join(raiz, 'public')));
  app.use(express.urlencoded({ extended: false }));
  app.use(lerAviso);

  app.use((req, res, proximo) => {
    Object.assign(res.locals, fmt, {
      ...validacao,
      classeCultura,
      tipoInfo,
      ejson: (doc) => EJSON.stringify(doc, null, 2, { relaxed: true }),
      caminho: req.path,
    });
    // Grava o aviso num cookie para aparecer depois do redirect
    res.avisar = (texto, tipo = 'ok') =>
      res.cookie('aviso', encodeURIComponent(JSON.stringify({ texto, tipo })), { httpOnly: true, sameSite: 'lax', path: '/' });
    proximo();
  });

  app.use('/', require('./rotas/painel'));
  app.use('/talhoes', require('./rotas/talhoes'));
  app.use('/insumos', require('./rotas/insumos'));
  app.use('/relatorios', require('./rotas/relatorios'));
  app.use('/banco', require('./rotas/banco'));

  app.use((req, res) => {
    res.status(404).render('erro', { titulo: 'Página não encontrada', ativo: '', codigo: 404, mensagem: 'Não achamos esta página no caderno.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((erro, req, res, proximo) => {
    if (erro instanceof ErroNegocio) {
      return res.status(422).render('erro', { titulo: 'Não foi possível concluir', ativo: '', codigo: 422, mensagem: erro.message });
    }
    console.error(erro);
    res.status(500).render('erro', { titulo: 'Algo deu errado', ativo: '', codigo: 500, mensagem: 'Erro interno. Veja o terminal do servidor para os detalhes.' });
  });

  return app;
}

module.exports = { criarApp };
