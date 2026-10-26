const express = require('express');
const rel = require('../repositorios/relatorios');
const insumos = require('../repositorios/insumos');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const talhoes = getDb().collection('talhoes');
  const [totalTalhoes, porCultura, ultimas, baixos] = await Promise.all([
    talhoes.countDocuments(),
    rel.areaPorCultura(),
    rel.ultimasOperacoes(8),
    insumos.listarInsumosAbaixoDoMinimo(),
  ]);
  const tipos = await rel.operacoesPorTipo();
  const totalOperacoes = tipos.reduce((soma, t) => soma + t.total, 0);
  const areaTotal = porCultura.reduce((soma, c) => soma + c.area_ha, 0);
  res.render('painel', {
    titulo: 'Painel', ativo: 'painel',
    totais: { talhoes: totalTalhoes, areaTotal, operacoes: totalOperacoes, baixos: baixos.length },
    porCultura, ultimas, baixos,
  });
});

module.exports = router;
