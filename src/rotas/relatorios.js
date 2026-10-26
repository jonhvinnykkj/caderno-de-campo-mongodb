const express = require('express');
const rel = require('../repositorios/relatorios');

const router = express.Router();

router.get('/', async (req, res) => {
  const [custo, tipos, produtividade, porCultura] = await Promise.all([
    rel.custoPorTalhao(), rel.operacoesPorTipo(), rel.produtividadePorCultura(), rel.areaPorCultura(),
  ]);
  res.render('relatorios', {
    titulo: 'Relatórios', ativo: 'relatorios', custo, tipos, produtividade, porCultura,
    pipelines: {
      custo: rel.PIPELINE_CUSTO_POR_TALHAO, tipos: rel.PIPELINE_OPERACOES_POR_TIPO,
      produtividade: rel.PIPELINE_PRODUTIVIDADE_POR_CULTURA, area: rel.PIPELINE_AREA_POR_CULTURA,
    },
  });
});

module.exports = router;
