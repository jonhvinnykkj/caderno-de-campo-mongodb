// Demonstração dos recursos do MongoDB direto no mongosh (evidência de comandos).
// Uso: mongosh "mongodb://127.0.0.1:27029/caderno_de_campo" docs/comandos-mongosh.js
// O script deixa o banco como estava: o talhão de demonstração T99 é criado e apagado.

const PROMPT = "caderno_de_campo> ";
function secao(titulo) { print("\n== " + titulo + " =="); }
function cmd(texto) { print(PROMPT + texto); }
// JSON indentado com as listas curtas numa linha só (printjson abre uma linha por item).
function compacto(obj) {
  return JSON.stringify(obj, null, 2).replace(/\[\n\s+((?:"[^"\n]*",?\n\s+)*"[^"\n]*")\n\s*\]/g, (m, itens) => "[" + itens.replace(/\n\s+/g, " ") + "]");
}
// Mostra o pipeline com um estágio por linha.
function pipeline(colecao, etapas) {
  return "db." + colecao + ".aggregate([\n  " + etapas.map(e => JSON.stringify(e)).join(",\n  ") + "\n])";
}
function limpaDemo() { db.talhoes.deleteMany({ codigo: "T99" }); }

limpaDemo();

secao("1. Coleções do banco (show collections)");
cmd("db.getCollectionNames()");
print(compacto(db.getCollectionNames()));

secao("2. Contagem de documentos (countDocuments)");
cmd("db.talhoes.countDocuments({})");
print(db.talhoes.countDocuments({}));
cmd("db.insumos.countDocuments({})");
print(db.insumos.countDocuments({}));
cmd('db.talhoes.countDocuments({ cultura: "amendoim" })');
print(db.talhoes.countDocuments({ cultura: "amendoim" }));

secao("3. Validador $jsonSchema (getCollectionInfos)");
const infoTalhoes = db.getCollectionInfos({ name: "talhoes" })[0];
cmd('db.getCollectionInfos({ name: "talhoes" })[0].options  // validador $jsonSchema (uma propriedade por linha)');
const esquema = infoTalhoes.options.validator.$jsonSchema;
print("validationLevel: " + infoTalhoes.options.validationLevel + ", validationAction: " + infoTalhoes.options.validationAction);
print("required: " + JSON.stringify(esquema.required));
Object.entries(esquema.properties).forEach(([campo, regra]) => {
  const texto = JSON.stringify(regra);
  print("  " + campo + ": " + (texto.length > 100 ? texto.slice(0, 100) + "..." : texto));
});
cmd('db.getCollectionInfos({ name: "insumos" })[0].options.validator.$jsonSchema.required');
print(compacto(db.getCollectionInfos({ name: "insumos" })[0].options.validator.$jsonSchema.required));

secao("4. Índices (getIndexes)");
cmd("db.talhoes.getIndexes()");
db.talhoes.getIndexes().forEach(i => print(JSON.stringify({ nome: i.name, chave: i.key, unico: !!i.unique })));
cmd("db.insumos.getIndexes()");
db.insumos.getIndexes().forEach(i => print(JSON.stringify({ nome: i.name, chave: i.key })));

secao("5. find com filtro, projeção, sort e limit");
cmd('db.talhoes.find({ status: "em andamento" }, { _id: 0, codigo: 1, nome: 1, cultura: 1, area_ha: 1 }).sort({ area_ha: -1 }).limit(5)');
console.table(db.talhoes.find({ status: "em andamento" }, { _id: 0, codigo: 1, nome: 1, cultura: 1, area_ha: 1 }).sort({ area_ha: -1 }).limit(5).toArray());

secao("6. findOne: um talhão com as operações embutidas");
cmd("db.talhoes.findOne({ operacoes: { $exists: true, $ne: [] } })");
const exemplo = db.talhoes.findOne({ operacoes: { $exists: true, $ne: [] } });
if (exemplo) {
  const total = exemplo.operacoes.length;
  exemplo.operacoes = exemplo.operacoes.slice(0, 1); // só duas, para caber na tela
  printjson(exemplo);
  print("(mostrada 1 de " + total + " operações embutidas)");
}

secao("7. Busca textual ($text com textScore)");
cmd('db.talhoes.find({ $text: { $search: "irrigado" } }, { _id: 0, codigo: 1, nome: 1, tags: 1, pontos: { $meta: "textScore" } }).sort({ pontos: { $meta: "textScore" } })');
console.table(db.talhoes.find({ $text: { $search: "irrigado" } }, { _id: 0, codigo: 1, nome: 1, tags: 1, pontos: { $meta: "textScore" } }).sort({ pontos: { $meta: "textScore" } }).limit(5).toArray());

secao("8. CRUD no talhão de demonstração T99");
const agora = new Date();
cmd('db.talhoes.insertOne({ codigo: "T99", nome: "Talhão de demonstração", cultura: "milho", area_ha: 10, safra: "2026/27", status: "planejado", tags: [], operacoes: [] })');
const ins = db.talhoes.insertOne({
  codigo: "T99", nome: "Talhão de demonstração", cultura: "milho", variedade: "AG 8088",
  area_ha: 10, safra: "2026/27", status: "planejado", tags: [], operacoes: [],
  criado_em: agora, atualizado_em: agora
});
printjson(ins);

cmd('db.talhoes.updateOne({ codigo: "T99" }, { $set: { status: "em andamento", area_ha: 12.5 } })');
printjson(db.talhoes.updateOne({ codigo: "T99" }, { $set: { status: "em andamento", area_ha: 12.5, atualizado_em: new Date() } }));

const insumo = db.insumos.findOne({ categoria: "fertilizante" }) || db.insumos.findOne();
const idOp = new ObjectId();
const operacao = {
  _id: idOp, tipo: "adubação", data: new Date(), responsavel: "João", observacao: "demonstração",
  insumo: insumo ? { _id: insumo._id, nome: insumo.nome, unidade: insumo.unidade, preco_unitario: insumo.preco_unitario } : null,
  dose_por_ha: 100, quantidade_total: 1250, produtividade_sc_ha: null
};
cmd('db.talhoes.updateOne({ codigo: "T99" }, { $push: { operacoes: { tipo: "adubação", dose_por_ha: 100, ... } } })');
printjson(db.talhoes.updateOne({ codigo: "T99" }, { $push: { operacoes: operacao }, $set: { atualizado_em: new Date() } }));

cmd('db.talhoes.updateOne({ codigo: "T99" }, { $set: { "operacoes.$[op].dose_por_ha": 120, "operacoes.$[op].quantidade_total": 1500 } }, { arrayFilters: [{ "op._id": idOp }] })');
printjson(db.talhoes.updateOne(
  { codigo: "T99" },
  { $set: { "operacoes.$[op].dose_por_ha": 120, "operacoes.$[op].quantidade_total": 1500 } },
  { arrayFilters: [{ "op._id": idOp }] }
));
cmd('db.talhoes.findOne({ codigo: "T99" }, { _id: 0, codigo: 1, "operacoes.tipo": 1, "operacoes.dose_por_ha": 1, "operacoes.quantidade_total": 1 })');
print(compacto(db.talhoes.findOne({ codigo: "T99" }, { _id: 0, codigo: 1, "operacoes.tipo": 1, "operacoes.dose_por_ha": 1, "operacoes.quantidade_total": 1 })));

cmd('db.talhoes.updateOne({ codigo: "T99" }, { $pull: { operacoes: { _id: idOp } } })');
printjson(db.talhoes.updateOne({ codigo: "T99" }, { $pull: { operacoes: { _id: idOp } } }));
cmd('db.talhoes.findOne({ codigo: "T99" }).operacoes.length');
print(db.talhoes.findOne({ codigo: "T99" }).operacoes.length);

cmd('db.talhoes.deleteOne({ codigo: "T99" })');
printjson(db.talhoes.deleteOne({ codigo: "T99" }));
cmd('db.talhoes.countDocuments({ codigo: "T99" })');
print(db.talhoes.countDocuments({ codigo: "T99" }));

secao("9. Validador recusando documento inválido (erro 121)");
cmd('db.talhoes.insertOne({ codigo: "T99", nome: "Inválido", cultura: "banana", area_ha: -5, safra: "2026", status: "?" })');
try {
  db.talhoes.insertOne({ codigo: "T99", nome: "Inválido", cultura: "banana", area_ha: -5, safra: "2026", status: "?", tags: [], operacoes: [], criado_em: new Date(), atualizado_em: new Date() });
  print("ATENÇÃO: o documento inválido foi aceito (validador ausente?)");
  limpaDemo();
} catch (e) {
  print("código do erro: " + e.code);
  print("mensagem: " + e.message);
}

secao("10. Índice unique recusando código duplicado (erro 11000)");
const codigoExistente = db.talhoes.findOne().codigo;
cmd('db.talhoes.insertOne({ codigo: "' + codigoExistente + '", ... })');
try {
  const d = new Date();
  db.talhoes.insertOne({ codigo: codigoExistente, nome: "Duplicado", cultura: "soja", area_ha: 5, safra: "2026/27", status: "planejado", tags: [], operacoes: [], criado_em: d, atualizado_em: d });
  print("ATENÇÃO: o duplicado foi aceito (índice unique ausente?)");
  db.talhoes.deleteOne({ nome: "Duplicado" });
} catch (e) {
  print("código do erro: " + e.code);
  print("mensagem: " + e.message);
}

secao("11. Agregação: área total por cultura ($group)");
const p1 = [
  { $group: { _id: "$cultura", talhoes: { $sum: 1 }, area_total_ha: { $sum: "$area_ha" } } },
  { $sort: { area_total_ha: -1 } }
];
cmd(pipeline("talhoes", p1));
console.table(db.talhoes.aggregate(p1).toArray());

secao("12. Agregação: operações por tipo ($unwind + $group)");
const p2 = [
  { $unwind: "$operacoes" },
  { $group: { _id: "$operacoes.tipo", total: { $sum: 1 } } },
  { $sort: { total: -1 } }
];
cmd(pipeline("talhoes", p2));
console.table(db.talhoes.aggregate(p2).toArray());

secao("13. Agregação: custo de insumos por talhão ($unwind + $lookup + $group)");
const p3 = [
  { $unwind: "$operacoes" },
  { $match: { "operacoes.insumo": { $ne: null } } },
  { $lookup: { from: "insumos", localField: "operacoes.insumo._id", foreignField: "_id", as: "ins" } },
  { $unwind: "$ins" },
  { $group: {
      _id: "$codigo",
      custo: { $sum: { $multiply: ["$operacoes.quantidade_total", "$operacoes.insumo.preco_unitario"] } },
      categorias: { $addToSet: "$ins.categoria" } } },
  { $project: { custo: { $round: ["$custo", 2] }, categorias: 1 } },
  { $sort: { custo: -1 } }
];
cmd(pipeline("talhoes", p3));
console.table(db.talhoes.aggregate(p3).toArray().map(r => ({ talhao: r._id, custo_rs: r.custo, categorias: r.categorias.join(", ") })));

secao("14. Agregação: produtividade média por cultura ($match + $group + $avg)");
const p4 = [
  { $unwind: "$operacoes" },
  { $match: { "operacoes.tipo": "colheita", "operacoes.produtividade_sc_ha": { $ne: null } } },
  { $group: { _id: "$cultura", colheitas: { $sum: 1 }, produtividade_media_sc_ha: { $avg: "$operacoes.produtividade_sc_ha" } } },
  { $project: { colheitas: 1, produtividade_media_sc_ha: { $round: ["$produtividade_media_sc_ha", 1] } } },
  { $sort: { produtividade_media_sc_ha: -1 } }
];
cmd(pipeline("talhoes", p4));
console.table(db.talhoes.aggregate(p4).toArray());

secao("15. Insumos abaixo do estoque mínimo ($expr)");
cmd('db.insumos.find({ $expr: { $lt: ["$estoque", "$estoque_minimo"] } }, { _id: 0, nome: 1, unidade: 1, estoque: 1, estoque_minimo: 1 })');
console.table(db.insumos.find({ $expr: { $lt: ["$estoque", "$estoque_minimo"] } }, { _id: 0, nome: 1, unidade: 1, estoque: 1, estoque_minimo: 1 }).toArray());

secao("16. Conferência: o banco voltou ao estado inicial");
cmd('db.talhoes.countDocuments({ codigo: "T99" })');
print(db.talhoes.countDocuments({ codigo: "T99" }));
cmd("db.talhoes.countDocuments({})");
print(db.talhoes.countDocuments({}));
