const express = require('express');
const { validarTalhao, validarOperacao, CULTURAS, STATUS_TALHAO } = require('../validacao');
const talhoes = require('../repositorios/talhoes');
const insumos = require('../repositorios/insumos');
const { naoEncontrado, erroNoCampo } = require('./auxiliar');

const router = express.Router();
const VAZIO = { codigo: '', nome: '', cultura: 'soja', variedade: '', area_ha: '', safra: '2026/27', status: 'planejado', tags: [] };

// ---------- Lista ----------
router.get('/', async (req, res) => {
  const { cultura = '', status = '', q = '', ordem = 'codigo', pagina = 1 } = req.query;
  const resultado = await talhoes.listarTalhoes({ cultura, status, q: String(q).trim(), ordem, pagina });
  res.render('talhoes_lista', {
    titulo: 'Talhões', ativo: 'talhoes', ...resultado, filtros: { cultura, status, q, ordem },
    CULTURAS, STATUS_TALHAO,
  });
});

// ---------- Criar ----------
router.get('/novo', (req, res) => {
  res.render('talhao_form', { titulo: 'Novo talhão', ativo: 'talhoes', modo: 'novo', valores: VAZIO, erros: {}, CULTURAS, STATUS_TALHAO });
});

router.post('/', async (req, res) => {
  const { valores, erros } = validarTalhao(req.body);
  if (!Object.keys(erros).length) {
    try {
      const id = await talhoes.criarTalhao(valores);
      res.avisar(`Talhão ${valores.codigo} criado`);
      return res.redirect(`/talhoes/${id}`);
    } catch (erro) {
      erroNoCampo(erro, erros);
    }
  }
  res.status(422).render('talhao_form', { titulo: 'Novo talhão', ativo: 'talhoes', modo: 'novo', valores, erros, CULTURAS, STATUS_TALHAO });
});

// ---------- Ficha ----------
async function renderFicha(res, talhao, extra = {}) {
  const lista = await insumos.listarInsumosParaSelecao();
  const operacoes = [...talhao.operacoes].sort((a, b) => b.data - a.data || String(b._id).localeCompare(String(a._id)));
  const hoje = new Date().toISOString().slice(0, 10);
  return res.render('talhao_ficha', {
    titulo: `${talhao.codigo} · ${talhao.nome}`, ativo: 'talhoes', talhao, operacoes, insumosLista: lista,
    valoresOp: { tipo: 'adubação', data: hoje, insumo_id: '', dose_por_ha: '', produtividade_sc_ha: '', responsavel: '', observacao: '' },
    errosOp: {}, ...extra,
  });
}

router.get('/:id', async (req, res) => {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão');
  await renderFicha(res, talhao);
});

// ---------- Editar ----------
router.get('/:id/editar', async (req, res) => {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão');
  res.render('talhao_form', { titulo: `Editar ${talhao.codigo}`, ativo: 'talhoes', modo: 'editar', id: talhao._id, valores: { ...VAZIO, ...talhao }, erros: {}, CULTURAS, STATUS_TALHAO });
});

router.post('/:id', async (req, res) => {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão');
  const { valores, erros } = validarTalhao(req.body);
  if (!Object.keys(erros).length) {
    try {
      await talhoes.editarTalhao(req.params.id, valores);
      res.avisar(`Talhão ${valores.codigo} atualizado`);
      return res.redirect(`/talhoes/${req.params.id}`);
    } catch (erro) {
      erroNoCampo(erro, erros);
    }
  }
  res.status(422).render('talhao_form', { titulo: `Editar ${talhao.codigo}`, ativo: 'talhoes', modo: 'editar', id: talhao._id, valores, erros, CULTURAS, STATUS_TALHAO });
});

// ---------- Excluir ----------
router.get('/:id/excluir', async (req, res) => {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão');
  res.render('talhao_excluir', { titulo: `Excluir ${talhao.codigo}`, ativo: 'talhoes', talhao });
});

router.post('/:id/excluir', async (req, res) => {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão');
  await talhoes.excluirTalhao(req.params.id);
  res.avisar(`Talhão ${talhao.codigo} excluído; o estoque dos insumos foi devolvido`);
  res.redirect('/talhoes');
});

// ---------- Operações ----------
router.post('/:id/operacoes', async (req, res) => {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão');
  const { valores, erros } = validarOperacao(req.body);
  if (!Object.keys(erros).length) {
    try {
      await talhoes.registrarOperacao(req.params.id, valores);
      res.avisar(`Operação de ${valores.tipo} registrada`);
      return res.redirect(`/talhoes/${req.params.id}`);
    } catch (erro) {
      erroNoCampo(erro, erros);
    }
  }
  res.status(422);
  await renderFicha(res, talhao, { valoresOp: valores, errosOp: erros });
});

async function carregarOperacao(req, res) {
  const talhao = await talhoes.buscarTalhao(req.params.id);
  if (!talhao) return naoEncontrado(res, 'O talhão') && null;
  const operacao = talhao.operacoes.find((o) => String(o._id) === req.params.opId);
  if (!operacao) return naoEncontrado(res, 'A operação') && null;
  return { talhao, operacao };
}

router.get('/:id/operacoes/:opId/editar', async (req, res) => {
  const achou = await carregarOperacao(req, res);
  if (!achou) return;
  const { talhao, operacao } = achou;
  res.render('operacao_form', {
    titulo: `Editar operação · ${talhao.codigo}`, ativo: 'talhoes', talhao, operacao,
    insumosLista: await insumos.listarInsumosParaSelecao(), erros: {},
    valores: {
      tipo: operacao.tipo, data: operacao.data.toISOString().slice(0, 10), insumo_id: operacao.insumo ? String(operacao.insumo._id) : '',
      dose_por_ha: operacao.dose_por_ha ?? '', produtividade_sc_ha: operacao.produtividade_sc_ha ?? '',
      responsavel: operacao.responsavel, observacao: operacao.observacao || '',
    },
  });
});

router.post('/:id/operacoes/:opId', async (req, res) => {
  const achou = await carregarOperacao(req, res);
  if (!achou) return;
  const { talhao, operacao } = achou;
  const { valores, erros } = validarOperacao(req.body);
  if (!Object.keys(erros).length) {
    try {
      await talhoes.editarOperacao(req.params.id, req.params.opId, valores);
      res.avisar('Operação atualizada; o estoque foi acertado');
      return res.redirect(`/talhoes/${req.params.id}`);
    } catch (erro) {
      erroNoCampo(erro, erros);
    }
  }
  res.status(422).render('operacao_form', {
    titulo: `Editar operação · ${talhao.codigo}`, ativo: 'talhoes', talhao, operacao,
    insumosLista: await insumos.listarInsumosParaSelecao(), erros, valores,
  });
});

router.get('/:id/operacoes/:opId/excluir', async (req, res) => {
  const achou = await carregarOperacao(req, res);
  if (!achou) return;
  res.render('operacao_excluir', { titulo: 'Excluir operação', ativo: 'talhoes', ...achou });
});

router.post('/:id/operacoes/:opId/excluir', async (req, res) => {
  const achou = await carregarOperacao(req, res);
  if (!achou) return;
  await talhoes.excluirOperacao(req.params.id, req.params.opId);
  res.avisar(`Operação de ${achou.operacao.tipo} excluída${achou.operacao.insumo ? '; o estoque foi devolvido' : ''}`);
  res.redirect(`/talhoes/${req.params.id}`);
});

module.exports = router;
