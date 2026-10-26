// Caminhos e endereços compartilhados pelos scripts do relatório.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const RAIZ_RELATORIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAIZ_PROJETO = path.resolve(RAIZ_RELATORIO, '..');
export const SAIDA = path.join(RAIZ_RELATORIO, 'saida');
export const PRINTS = path.join(SAIDA, 'prints');
export const CODIGO = path.join(SAIDA, 'codigo');
export const COMANDOS = path.join(SAIDA, 'comandos');
export const PDF = path.join(SAIDA, 'Relatorio-IAL215-Caderno-de-Campo.pdf');

export const URL_APP = process.env.URL_APP || 'http://127.0.0.1:3415';
export const URL_MONGO_EXPRESS = process.env.URL_MONGO_EXPRESS || 'http://127.0.0.1:8089';
export const URI_MONGO = process.env.URI_MONGO || 'mongodb://127.0.0.1:27029/caderno_de_campo';
export const MONGOSH = process.env.MONGOSH || 'mongosh'; // precisa estar no PATH
export const LINK_GITHUB = 'https://github.com/jonhvinnykkj/caderno-de-campo-mongodb';
