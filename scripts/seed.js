// Apaga e recria os dados do Sítio Santa Luzia (Pompeia/SP): 12 insumos, 8 talhões e ~45 operações.
// O estoque final de cada insumo = compras - tudo o que as operações consumiram (conta feita aqui).
const { ObjectId } = require('mongodb');
const { conectar, fechar, NOME_BANCO } = require('../src/db');
const { configurarBanco } = require('./setup-banco');

// [nome, categoria, fabricante, unidade, compras, estoque_minimo, preço atual]
const INSUMOS = [
  ['Semente de amendoim IAC OL3', 'semente', 'Coplana', 'kg', 2500, 200, 9.8],
  ['Semente de soja Brasmax Desafio 8473 RSF', 'semente', 'Brasmax', 'sc', 60, 10, 285],
  ['Semente de milho DKB 390 PRO3', 'semente', 'Dekalb (Bayer)', 'sc', 40, 10, 690],
  ['Ureia 45% N', 'fertilizante', 'Yara', 'kg', 8000, 1500, 3.1],
  ['Formulado NPK 04-14-08', 'fertilizante', 'Mosaic', 'kg', 36000, 4000, 2.65],
  ['Cloreto de potássio 60% K2O', 'fertilizante', 'Mosaic', 'kg', 9500, 1500, 3.2],
  ['Formulado NPK 20-05-20', 'fertilizante', 'Yara', 'kg', 12000, 2000, 3.45],
  ['Calcário dolomítico PRNT 90%', 'corretivo', 'Mineradora regional', 'kg', 135000, 20000, 0.28],
  ['Roundup Original DI', 'defensivo', 'Bayer', 'L', 400, 100, 28.5],
  ['Orkestra SC', 'defensivo', 'Basf', 'L', 40, 20, 245],
  ['Aproach Prima', 'defensivo', 'Corteva', 'L', 30, 15, 310],
  ['Engeo Pleno S', 'defensivo', 'Syngenta', 'L', 20, 10, 385],
];

const TALHOES = [
  { codigo: 'T01', nome: 'Baixada do Córrego', cultura: 'amendoim', variedade: 'IAC OL3', area_ha: 18.5, safra: '2025/26', status: 'colhido', tags: ['plantio direto', 'rotação com cana'] },
  { codigo: 'T02', nome: 'Mata Velha', cultura: 'soja', variedade: 'Brasmax Desafio 8473 RSF', area_ha: 22, safra: '2026/27', status: 'em andamento', tags: ['plantio direto', 'sequeiro'] },
  { codigo: 'T03', nome: 'Várzea do Lajeado', cultura: 'milho', variedade: 'DKB 390 PRO3', area_ha: 15, safra: '2025/26', status: 'colhido', tags: ['safrinha', 'plantio direto'] },
  { codigo: 'T04', nome: 'Alto do Café', cultura: 'café', variedade: 'Catuaí Vermelho IAC 144', area_ha: 12, safra: '2025/26', status: 'colhido', tags: ['irrigado', 'adensado'] },
  { codigo: 'T05', nome: 'Canavial do Barracão', cultura: 'cana-de-açúcar', variedade: 'RB966928', area_ha: 28, safra: '2026/27', status: 'em andamento', tags: ['cana planta', 'ano e meio', 'colheita mecanizada'] },
  { codigo: 'T06', nome: 'Pasto Reformado', cultura: 'soja', variedade: 'Brasmax Desafio 8473 RSF', area_ha: 14.5, safra: '2025/26', status: 'colhido', tags: ['reforma de pastagem', 'plantio direto'] },
  { codigo: 'T07', nome: 'Beira da Estrada', cultura: 'milho', variedade: 'DKB 390 PRO3', area_ha: 10, safra: '2026/27', status: 'planejado', tags: ['primeira safra'] },
  { codigo: 'T08', nome: 'Sede Velha', cultura: 'pousio', area_ha: 6, safra: '2026/27', status: 'planejado', tags: ['pousio', 'recuperação de solo'] },
];

const AP = 'Aparecido Ferreira';
const MA = 'Marcos Vilela';
const RO = 'Rogério Tanaka';
const DA = 'Daniela Souza';

// [talhão, data, tipo, insumo (início do nome) ou null, dose/ha, responsável, observação, produtividade sc/ha]
const OPERACOES = [
  // T01 amendoim
  ['T01', '2025-09-15', 'preparo de solo', null, null, AP, 'Aração e gradagem após a reforma do canavial.'],
  ['T01', '2025-09-22', 'preparo de solo', 'Calcário', 1500, AP, 'Calagem a lanço, 60 dias antes do plantio.'],
  ['T01', '2025-10-18', 'pulverização', 'Roundup', 2.5, MA, 'Dessecação em área total.'],
  ['T01', '2025-10-28', 'plantio', 'Semente de amendoim', 110, MA, 'Plantadeira de 4 linhas, espaçamento de 0,90 m.'],
  ['T01', '2025-11-05', 'adubação', 'Formulado NPK 04-14-08', 300, DA, 'Adubação na linha de plantio.'],
  ['T01', '2025-12-10', 'pulverização', 'Orkestra', 0.35, MA, 'Primeira aplicação contra mancha-preta.'],
  ['T01', '2026-01-08', 'pulverização', 'Orkestra', 0.35, MA, 'Segunda aplicação, 29 dias depois.'],
  ['T01', '2026-03-12', 'colheita', null, null, RO, 'Arranquio e trilha. Saca de 25 kg em casca.', 168],
  // T02 soja 2026/27
  ['T02', '2026-09-02', 'preparo de solo', 'Calcário', 1200, AP, 'Calagem com base na análise de solo de agosto.'],
  ['T02', '2026-10-01', 'pulverização', 'Roundup', 2.5, MA, 'Dessecação antes do plantio.'],
  ['T02', '2026-10-15', 'plantio', 'Semente de soja', 1.2, MA, 'Plantio direto, 14 sementes por metro.'],
  ['T02', '2026-10-15', 'adubação', 'Formulado NPK 04-14-08', 250, DA, 'Adubação junto com o plantio.'],
  // T03 milho safrinha
  ['T03', '2026-02-14', 'pulverização', 'Roundup', 2, MA, 'Dessecação após a colheita da soja.'],
  ['T03', '2026-02-24', 'plantio', 'Semente de milho', 1, MA, 'Um saco de 60 mil sementes por hectare.'],
  ['T03', '2026-02-24', 'adubação', 'Formulado NPK 04-14-08', 280, DA, 'Adubação de base.'],
  ['T03', '2026-03-26', 'adubação', 'Ureia', 150, DA, 'Cobertura com o milho em V4.'],
  ['T03', '2026-04-08', 'pulverização', 'Engeo Pleno S', 0.2, MA, 'Controle de lagarta-do-cartucho e percevejo.'],
  ['T03', '2026-04-22', 'pulverização', 'Aproach Prima', 0.3, MA, 'Fungicida no pré-pendoamento.'],
  ['T03', '2026-07-18', 'colheita', null, null, RO, 'Colheita com umidade de 16%. Saca de 60 kg.', 112],
  // T04 café
  ['T04', '2025-08-12', 'pulverização', 'Roundup', 2, MA, 'Capina química nas entrelinhas.'],
  ['T04', '2025-10-20', 'adubação', 'Formulado NPK 20-05-20', 400, DA, 'Primeira parcela, aplicada na projeção da copa.'],
  ['T04', '2025-12-05', 'adubação', 'Formulado NPK 20-05-20', 350, DA, 'Segunda parcela.'],
  ['T04', '2026-01-20', 'adubação', 'Cloreto de potássio', 150, DA, 'Potássio para enchimento de grão.'],
  ['T04', '2026-02-10', 'pulverização', 'Aproach Prima', 0.3, MA, 'Controle preventivo de ferrugem.'],
  ['T04', '2026-03-18', 'pulverização', 'Engeo Pleno S', 0.25, MA, 'Controle de bicho-mineiro.'],
  ['T04', '2026-06-20', 'colheita', null, null, RO, 'Colheita mecanizada (derriça). Saca de 60 kg de café beneficiado.', 34],
  // T05 cana planta
  ['T05', '2025-03-12', 'preparo de solo', 'Calcário', 1500, AP, 'Calagem e subsolagem antes do plantio.'],
  ['T05', '2025-03-26', 'plantio', null, null, AP, 'Mudas do viveiro próprio, 14 gemas por metro de sulco.'],
  ['T05', '2025-04-02', 'adubação', 'Formulado NPK 04-14-08', 500, DA, 'Adubação no sulco de plantio.'],
  ['T05', '2025-05-20', 'pulverização', 'Roundup', 2, MA, 'Controle de plantas daninhas na entrelinha.'],
  ['T05', '2026-01-15', 'adubação', 'Ureia', 120, DA, 'Cobertura nitrogenada.'],
  ['T05', '2026-03-10', 'adubação', 'Cloreto de potássio', 120, DA, 'Cobertura potássica.'],
  ['T05', '2026-09-14', 'pulverização', 'Engeo Pleno S', 0.25, MA, 'Controle de cigarrinha na reta final do ciclo.'],
  // T06 soja 2025/26
  ['T06', '2025-09-20', 'preparo de solo', 'Calcário', 1000, AP, 'Calagem de manutenção.'],
  ['T06', '2025-10-05', 'pulverização', 'Roundup', 2.5, MA, 'Dessecação em área total.'],
  ['T06', '2025-10-22', 'plantio', 'Semente de soja', 1.2, MA, 'Plantio direto sobre a palhada da braquiária.'],
  ['T06', '2025-10-22', 'adubação', 'Formulado NPK 04-14-08', 250, DA, 'Adubação junto com o plantio.'],
  ['T06', '2025-12-02', 'adubação', 'Cloreto de potássio', 100, DA, 'Potássio em cobertura.'],
  ['T06', '2025-12-12', 'pulverização', 'Orkestra', 0.35, MA, 'Primeira aplicação contra ferrugem-asiática.'],
  ['T06', '2026-01-10', 'pulverização', 'Engeo Pleno S', 0.2, MA, 'Controle de percevejo no enchimento de grão.'],
  ['T06', '2026-01-14', 'pulverização', 'Aproach Prima', 0.3, MA, 'Segunda aplicação de fungicida.'],
  ['T06', '2026-02-20', 'colheita', null, null, RO, 'Colheita com umidade de 13%. Saca de 60 kg.', 63],
  // T07 e T08
  ['T07', '2026-10-20', 'preparo de solo', 'Calcário', 1000, AP, 'Calagem para o milho da primeira safra.'],
  ['T08', '2025-08-20', 'preparo de solo', null, null, AP, 'Gradagem leve; área em descanso desde a safra 2024/25.'],
  ['T08', '2026-09-10', 'pulverização', 'Roundup', 2, MA, 'Controle de plantas daninhas no pousio.'],
];

const arredondar = (n) => Math.round(n * 100) / 100;

function montarDados() {
  const agora = new Date();
  const insumos = INSUMOS.map(([nome, categoria, fabricante, unidade, compras, minimo, preco]) => ({
    _id: new ObjectId(), nome, categoria, fabricante, unidade, compras, estoque_minimo: minimo, preco_unitario: preco,
    criado_em: new Date('2025-08-01T12:00:00Z'), atualizado_em: agora,
  }));
  const consumo = new Map(insumos.map((i) => [String(i._id), 0]));

  const talhoes = TALHOES.map((t) => ({ _id: new ObjectId(), ...t, operacoes: [], criado_em: new Date('2025-08-01T12:00:00Z'), atualizado_em: agora }));

  for (const [codigo, data, tipo, prefixo, dose, responsavel, observacao, produtividade] of OPERACOES) {
    const talhao = talhoes.find((t) => t.codigo === codigo);
    const insumo = prefixo ? insumos.find((i) => i.nome.startsWith(prefixo)) : null;
    if (prefixo && !insumo) throw new Error(`Insumo não encontrado no seed: ${prefixo}`);
    const quantidade = insumo ? arredondar(dose * talhao.area_ha) : null;
    if (insumo) consumo.set(String(insumo._id), consumo.get(String(insumo._id)) + quantidade);
    // preço do dia: em 2025 os insumos estavam ~6% mais baratos que hoje
    const fator = data.startsWith('2025') ? 0.94 : 1;
    talhao.operacoes.push({
      _id: new ObjectId(),
      tipo,
      data: new Date(`${data}T00:00:00Z`),
      insumo: insumo ? { _id: insumo._id, nome: insumo.nome, unidade: insumo.unidade, preco_unitario: arredondar(insumo.preco_unitario * fator) } : null,
      dose_por_ha: insumo ? dose : null,
      quantidade_total: quantidade,
      produtividade_sc_ha: produtividade ?? null,
      responsavel,
      observacao,
    });
  }

  const insumosFinais = insumos.map(({ compras, ...i }) => {
    const estoque = arredondar(compras - consumo.get(String(i._id)));
    if (estoque < 0) throw new Error(`Estoque negativo no seed: ${i.nome}`);
    return { ...i, estoque };
  });
  return { insumos: insumosFinais, talhoes };
}

async function semear(db) {
  await configurarBanco(db);
  await db.collection('talhoes').deleteMany({});
  await db.collection('insumos').deleteMany({});
  const { insumos, talhoes } = montarDados();
  // Recurso: insertMany
  await db.collection('insumos').insertMany(insumos);
  await db.collection('talhoes').insertMany(talhoes);
  return { insumos, talhoes };
}

module.exports = { semear, montarDados };

if (require.main === module) {
  (async () => {
    const db = await conectar();
    const { insumos, talhoes } = await semear(db);
    const operacoes = talhoes.reduce((s, t) => s + t.operacoes.length, 0);
    console.log(`Banco "${NOME_BANCO}" recriado: ${insumos.length} insumos, ${talhoes.length} talhões e ${operacoes} operações.`);
    insumos.filter((i) => i.estoque < i.estoque_minimo).forEach((i) => console.log(`  abaixo do mínimo: ${i.nome} (${i.estoque} ${i.unidade} < ${i.estoque_minimo})`));
    await fechar();
  })().catch((e) => {
    console.error('Falha no seed:', e.message);
    process.exit(1);
  });
}
