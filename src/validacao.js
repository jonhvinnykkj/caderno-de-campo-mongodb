// Validação dos formulários no servidor. Cada função devolve { valores, erros }.
const CULTURAS = ['amendoim', 'milho', 'soja', 'cana-de-açúcar', 'café', 'pousio'];
const STATUS_TALHAO = ['planejado', 'em andamento', 'colhido'];
const TIPOS_OPERACAO = ['preparo de solo', 'plantio', 'adubação', 'pulverização', 'colheita'];
const CATEGORIAS = ['semente', 'fertilizante', 'defensivo', 'corretivo'];
const UNIDADES = ['kg', 'L', 'sc'];

// "18,5" ou "18.5" -> 18.5 ; vazio -> null ; inválido -> NaN
function lerNumero(texto) {
  const t = String(texto ?? '').trim().replace(/\s/g, '');
  if (t === '') return null;
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return /^-?\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : NaN;
}

const texto = (v) => String(v ?? '').trim();

function validarTalhao(corpo) {
  const erros = {};
  const v = {
    codigo: texto(corpo.codigo).toUpperCase(),
    nome: texto(corpo.nome),
    cultura: texto(corpo.cultura),
    variedade: texto(corpo.variedade),
    area_ha: lerNumero(corpo.area_ha),
    safra: texto(corpo.safra),
    status: texto(corpo.status),
    tags: texto(corpo.tags).split(',').map((t) => t.trim()).filter(Boolean),
  };
  if (!/^T\d{2}$/.test(v.codigo)) erros.codigo = 'Use a letra T e dois dígitos, por exemplo T09.';
  if (v.nome.length < 2 || v.nome.length > 80) erros.nome = 'Informe o nome (2 a 80 caracteres).';
  if (!CULTURAS.includes(v.cultura)) erros.cultura = 'Escolha uma cultura da lista.';
  if (v.area_ha === null || Number.isNaN(v.area_ha) || v.area_ha <= 0) erros.area_ha = 'Informe uma área maior que zero.';
  if (!/^\d{4}\/\d{2}$/.test(v.safra)) erros.safra = 'Use o formato AAAA/AA, por exemplo 2026/27.';
  if (!STATUS_TALHAO.includes(v.status)) erros.status = 'Escolha um status da lista.';
  if (v.variedade.length > 60) erros.variedade = 'No máximo 60 caracteres.';
  return { valores: v, erros };
}

function validarInsumo(corpo) {
  const erros = {};
  const v = {
    nome: texto(corpo.nome),
    categoria: texto(corpo.categoria),
    fabricante: texto(corpo.fabricante),
    unidade: texto(corpo.unidade),
    estoque: lerNumero(corpo.estoque),
    estoque_minimo: lerNumero(corpo.estoque_minimo),
    preco_unitario: lerNumero(corpo.preco_unitario),
  };
  if (v.nome.length < 2 || v.nome.length > 80) erros.nome = 'Informe o nome (2 a 80 caracteres).';
  if (!CATEGORIAS.includes(v.categoria)) erros.categoria = 'Escolha uma categoria da lista.';
  if (!UNIDADES.includes(v.unidade)) erros.unidade = 'Escolha kg, L ou sc.';
  for (const campo of ['estoque', 'estoque_minimo', 'preco_unitario']) {
    if (v[campo] === null || Number.isNaN(v[campo]) || v[campo] < 0) erros[campo] = 'Informe um número maior ou igual a zero.';
  }
  return { valores: v, erros };
}

function validarOperacao(corpo) {
  const erros = {};
  const v = {
    tipo: texto(corpo.tipo),
    data: texto(corpo.data),
    insumo_id: texto(corpo.insumo_id),
    dose_por_ha: lerNumero(corpo.dose_por_ha),
    produtividade_sc_ha: lerNumero(corpo.produtividade_sc_ha),
    responsavel: texto(corpo.responsavel),
    observacao: texto(corpo.observacao),
  };
  if (!TIPOS_OPERACAO.includes(v.tipo)) erros.tipo = 'Escolha o tipo da operação.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data) || Number.isNaN(Date.parse(v.data))) erros.data = 'Informe uma data válida.';
  if (v.responsavel.length < 2) erros.responsavel = 'Informe quem executou.';
  if (v.observacao.length > 300) erros.observacao = 'No máximo 300 caracteres.';
  if (v.insumo_id) {
    if (!/^[0-9a-f]{24}$/i.test(v.insumo_id)) erros.insumo_id = 'Insumo inválido.';
    if (v.dose_por_ha === null || Number.isNaN(v.dose_por_ha) || v.dose_por_ha <= 0) erros.dose_por_ha = 'Informe a dose por hectare (maior que zero).';
  } else if (v.dose_por_ha !== null) {
    erros.insumo_id = 'Escolha o insumo da dose informada.';
  }
  if (v.tipo === 'colheita') {
    if (v.produtividade_sc_ha === null || Number.isNaN(v.produtividade_sc_ha) || v.produtividade_sc_ha <= 0) erros.produtividade_sc_ha = 'Informe a produtividade em sc/ha.';
  } else {
    v.produtividade_sc_ha = null;
  }
  if (['adubação', 'pulverização', 'plantio'].includes(v.tipo) && !v.insumo_id && v.tipo !== 'plantio') {
    erros.insumo_id = 'Esta operação precisa de um insumo.';
  }
  return { valores: v, erros };
}

module.exports = {
  CULTURAS, STATUS_TALHAO, TIPOS_OPERACAO, CATEGORIAS, UNIDADES,
  lerNumero, validarTalhao, validarInsumo, validarOperacao,
};
