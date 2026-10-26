// Pipelines de agregação. Ficam exportados como constantes para a tela mostrar o pipeline usado.
const { getDb } = require('../db');

const talhoes = () => getDb().collection('talhoes');

// $group: área total e número de talhões por cultura
const PIPELINE_AREA_POR_CULTURA = [
  { $group: { _id: '$cultura', area_ha: { $sum: '$area_ha' }, talhoes: { $sum: 1 } } },
  { $sort: { area_ha: -1 } },
];

// $unwind + $group: quantas operações de cada tipo
const PIPELINE_OPERACOES_POR_TIPO = [
  { $unwind: '$operacoes' },
  { $group: { _id: '$operacoes.tipo', total: { $sum: 1 } } },
  { $sort: { total: -1 } },
];

// $unwind + $sort + $limit: as operações mais recentes de todos os talhões
const pipelineUltimasOperacoes = (limite = 8) => [
  { $unwind: '$operacoes' },
  { $sort: { 'operacoes.data': -1, 'operacoes._id': -1 } },
  { $limit: limite },
  { $project: { _id: 0, talhao_id: '$_id', codigo: 1, talhao: '$nome', operacao: '$operacoes' } },
];
const PIPELINE_ULTIMAS_OPERACOES = pipelineUltimasOperacoes(8);

// $unwind + $lookup + $group (duas vezes): custo estimado de insumos por talhão, aberto por categoria
const PIPELINE_CUSTO_POR_TALHAO = [
  { $unwind: '$operacoes' },
  { $match: { 'operacoes.insumo': { $ne: null } } },
  { $lookup: { from: 'insumos', localField: 'operacoes.insumo._id', foreignField: '_id', as: 'insumo_atual' } },
  { $unwind: '$insumo_atual' },
  {
    $group: {
      _id: { codigo: '$codigo', nome: '$nome', area_ha: '$area_ha', categoria: '$insumo_atual.categoria' },
      custo: { $sum: { $multiply: ['$operacoes.quantidade_total', '$operacoes.insumo.preco_unitario'] } },
    },
  },
  {
    $group: {
      _id: '$_id.codigo',
      nome: { $first: '$_id.nome' },
      area_ha: { $first: '$_id.area_ha' },
      custo_total: { $sum: '$custo' },
      por_categoria: { $push: { categoria: '$_id.categoria', custo: '$custo' } },
    },
  },
  { $sort: { custo_total: -1 } },
];

// $match + $group com $avg: produtividade média das colheitas por cultura
const PIPELINE_PRODUTIVIDADE_POR_CULTURA = [
  { $unwind: '$operacoes' },
  { $match: { 'operacoes.tipo': 'colheita' } },
  {
    $group: {
      _id: '$cultura',
      media_sc_ha: { $avg: '$operacoes.produtividade_sc_ha' },
      maxima_sc_ha: { $max: '$operacoes.produtividade_sc_ha' },
      colheitas: { $sum: 1 },
    },
  },
  { $sort: { media_sc_ha: -1 } },
];

// $expr: insumos com estoque abaixo do mínimo (aqui como pipeline, para mostrar o $match com $expr)
const PIPELINE_INSUMOS_ABAIXO_DO_MINIMO = [
  { $match: { $expr: { $lt: ['$estoque', '$estoque_minimo'] } } },
  { $project: { nome: 1, unidade: 1, estoque: 1, estoque_minimo: 1, falta: { $subtract: ['$estoque_minimo', '$estoque'] } } },
  { $sort: { nome: 1 } },
];

const areaPorCultura = () => talhoes().aggregate(PIPELINE_AREA_POR_CULTURA).toArray();
const operacoesPorTipo = () => talhoes().aggregate(PIPELINE_OPERACOES_POR_TIPO).toArray();
const ultimasOperacoes = (limite = 8) => talhoes().aggregate(pipelineUltimasOperacoes(limite)).toArray();
const custoPorTalhao = () => talhoes().aggregate(PIPELINE_CUSTO_POR_TALHAO).toArray();
const produtividadePorCultura = () => talhoes().aggregate(PIPELINE_PRODUTIVIDADE_POR_CULTURA).toArray();
const insumosAbaixoDoMinimoAgregado = () => getDb().collection('insumos').aggregate(PIPELINE_INSUMOS_ABAIXO_DO_MINIMO).toArray();

module.exports = {
  PIPELINE_AREA_POR_CULTURA, PIPELINE_OPERACOES_POR_TIPO, PIPELINE_ULTIMAS_OPERACOES, PIPELINE_CUSTO_POR_TALHAO,
  PIPELINE_PRODUTIVIDADE_POR_CULTURA, PIPELINE_INSUMOS_ABAIXO_DO_MINIMO,
  areaPorCultura, operacoesPorTipo, ultimasOperacoes, custoPorTalhao, produtividadePorCultura, insumosAbaixoDoMinimoAgregado,
};
