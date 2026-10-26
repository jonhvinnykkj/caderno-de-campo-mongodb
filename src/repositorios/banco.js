// Estatísticas e metadados do banco, para a tela /banco (evidência ao vivo).
const { getDb, NOME_BANCO } = require('../db');

const COLECOES = ['talhoes', 'insumos'];

// Recursos: countDocuments, $collStats (aggregate), listIndexes, listCollections (validador), findOne
async function resumoDoBanco() {
  const db = getDb();
  const colecoes = [];
  for (const nome of COLECOES) {
    const colecao = db.collection(nome);
    const documentos = await colecao.countDocuments();
    const [stats] = await colecao.aggregate([{ $collStats: { storageStats: {} } }]).toArray();
    const indices = await colecao.listIndexes().toArray();
    const [info] = await db.listCollections({ name: nome }).toArray();
    const exemplo = await colecao.findOne({}, { sort: { _id: 1 } });
    colecoes.push({
      nome, documentos,
      tamanho_bytes: stats?.storageStats?.size ?? 0,
      tamanho_indices_bytes: stats?.storageStats?.totalIndexSize ?? 0,
      indices,
      validador: info?.options?.validator || null,
      exemplo,
    });
  }
  const versao = (await db.admin().serverInfo()).version;
  return { banco: NOME_BANCO, versao, colecoes };
}

module.exports = { resumoDoBanco };
