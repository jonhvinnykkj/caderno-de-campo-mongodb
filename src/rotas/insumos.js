const express = require('express');
const { validarInsumo, CATEGORIAS, UNIDADES } = require('../validacao');
const insumos = require('../repositorios/insumos');
const { naoEncontrado, erroNoCampo } = require('./auxiliar');

const router = express.Router();
const VAZIO = { nome: '', categoria: 'fertilizante', fabricante: '', unidade: 'kg', estoque: '', estoque_minimo: '', preco_unitario: '' };
const opcoes = { CATEGORIAS, UNIDADES };

router.get('/', async (req, res) => {
  const { categoria = '', baixo = '', q = '' } = req.query;
  const lista = await insumos.listarInsumos({ categoria, baixo: baixo === '1', q: String(q).trim() });
  res.render('insumos_lista', { titulo: 'Insumos', ativo: 'insumos', lista, filtros: { categoria, baixo, q }, ...opcoes });
});

router.get('/novo', (req, res) => {
  res.render('insumo_form', { titulo: 'Novo insumo', ativo: 'insumos', modo: 'novo', valores: VAZIO, erros: {}, ...opcoes });
});

router.post('/', async (req, res) => {
  const { valores, erros } = validarInsumo(req.body);
  if (!Object.keys(erros).length) {
    try {
      await insumos.criarInsumo(valores);
      res.avisar(`Insumo ${valores.nome} criado`);
      return res.redirect('/insumos');
    } catch (erro) {
      erroNoCampo(erro, erros);
    }
  }
  res.status(422).render('insumo_form', { titulo: 'Novo insumo', ativo: 'insumos', modo: 'novo', valores, erros, ...opcoes });
});

router.get('/:id/editar', async (req, res) => {
  const insumo = await insumos.buscarInsumo(req.params.id);
  if (!insumo) return naoEncontrado(res, 'O insumo');
  res.render('insumo_form', { titulo: `Editar ${insumo.nome}`, ativo: 'insumos', modo: 'editar', id: insumo._id, valores: { ...VAZIO, ...insumo }, erros: {}, ...opcoes });
});

router.post('/:id', async (req, res) => {
  const insumo = await insumos.buscarInsumo(req.params.id);
  if (!insumo) return naoEncontrado(res, 'O insumo');
  const { valores, erros } = validarInsumo(req.body);
  if (!Object.keys(erros).length) {
    try {
      await insumos.editarInsumo(req.params.id, valores);
      res.avisar(`Insumo ${valores.nome} atualizado`);
      return res.redirect('/insumos');
    } catch (erro) {
      erroNoCampo(erro, erros);
    }
  }
  res.status(422).render('insumo_form', { titulo: `Editar ${insumo.nome}`, ativo: 'insumos', modo: 'editar', id: insumo._id, valores, erros, ...opcoes });
});

router.get('/:id/excluir', async (req, res) => {
  const insumo = await insumos.buscarInsumo(req.params.id);
  if (!insumo) return naoEncontrado(res, 'O insumo');
  const emUso = await insumos.contarTalhoesQueUsam(req.params.id);
  res.render('insumo_excluir', { titulo: `Excluir ${insumo.nome}`, ativo: 'insumos', insumo, emUso, recusa: null });
});

router.post('/:id/excluir', async (req, res) => {
  const insumo = await insumos.buscarInsumo(req.params.id);
  if (!insumo) return naoEncontrado(res, 'O insumo');
  try {
    await insumos.excluirInsumo(req.params.id);
  } catch (erro) {
    const emUso = await insumos.contarTalhoesQueUsam(req.params.id);
    const erros = {};
    erroNoCampo(erro, erros);
    return res.status(409).render('insumo_excluir', { titulo: `Excluir ${insumo.nome}`, ativo: 'insumos', insumo, emUso, recusa: erros._geral });
  }
  res.avisar(`Insumo ${insumo.nome} excluído`);
  res.redirect('/insumos');
});

module.exports = router;
