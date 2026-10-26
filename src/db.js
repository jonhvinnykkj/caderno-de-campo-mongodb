// Conexão única com o MongoDB (driver oficial, sem Mongoose).
const path = require('node:path');
const { MongoClient } = require('mongodb');

// Lê o .env da raiz do projeto, se existir (Node 22 tem loadEnvFile nativo).
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  // sem .env: valem os padrões abaixo
}

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27029';
// Nos testes usamos outro banco para nunca tocar nos dados reais.
const NOME_BANCO =
  process.env.NODE_ENV === 'test'
    ? 'caderno_de_campo_teste'
    : process.env.DB_NOME || 'caderno_de_campo';

let cliente = null;
let banco = null;

async function conectar() {
  if (banco) return banco;
  cliente = new MongoClient(URI, { serverSelectionTimeoutMS: 5000 });
  await cliente.connect();
  banco = cliente.db(NOME_BANCO);
  return banco;
}

function getDb() {
  if (!banco) throw new Error('Banco ainda não conectado: chame conectar() primeiro.');
  return banco;
}

async function fechar() {
  if (cliente) await cliente.close();
  cliente = null;
  banco = null;
}

module.exports = { conectar, getDb, fechar, NOME_BANCO, URI };
