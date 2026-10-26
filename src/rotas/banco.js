const express = require('express');
const { resumoDoBanco } = require('../repositorios/banco');

const router = express.Router();

router.get('/', async (req, res) => {
  res.render('banco', { titulo: 'Banco de dados', ativo: 'banco', resumo: await resumoDoBanco() });
});

module.exports = router;
