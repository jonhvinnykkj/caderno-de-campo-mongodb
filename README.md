# Caderno de Campo

Aplicação CRUD da atividade prática de **IAL-215 · Banco de Dados NoSQL** (FATEC Pompeia, curso de Big Data no Agronegócio).

O "Caderno de Campo" registra os **talhões** do Sítio Santa Luzia (propriedade fictícia em Pompeia/SP), as **operações** feitas em cada um (preparo de solo, plantio, adubação, pulverização, colheita) e o **estoque de insumos**. Os dados ficam em **MongoDB**; as operações são subdocumentos embutidos no talhão e os insumos têm coleção própria.

- Node.js 22 + Express 5 + EJS (páginas renderizadas no servidor)
- Driver oficial `mongodb` (sem Mongoose): os comandos aparecem explícitos em `src/repositorios/`
- MongoDB 8 em Docker (porta 27029) e mongo-express (porta 8089)

## Requisitos

- Node.js 22 ou mais novo
- Docker (ou OrbStack) com `docker compose`
- Alternativa ao Docker: uma conta gratuita no MongoDB Atlas

## Passo a passo do zero

```bash
git clone https://github.com/jonhvinnykkj/caderno-de-campo-mongodb.git caderno-de-campo
cd caderno-de-campo
npm install
cp .env.example .env
npm run db:up      # sobe o MongoDB (27029) e o mongo-express (8089)
npm run db:seed    # cria coleções, validadores, índices e os dados de exemplo
npm start          # http://localhost:3415
```

Telas: <http://localhost:3415> (painel), `/talhoes`, `/insumos`, `/relatorios`, `/banco`.
Para ver os documentos no navegador: <http://localhost:8089> (mongo-express).

Outros comandos: `npm run db:setup` (só coleções e índices), `npm run dev` (reinicia ao salvar), `npm test`, `npm run db:down`.

## Usando o MongoDB Atlas

1. Crie um cluster gratuito no Atlas, um usuário de banco e libere seu IP em *Network Access*.
2. Copie a string de conexão e coloque no `.env`:
   ```
   MONGODB_URI=mongodb+srv://USUARIO:SENHA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Rode `npm run db:seed` e `npm start`. Não é preciso subir o Docker.

Atenção: `npm run db:seed` **apaga e recria** os dados do banco apontado no `.env`.

## Testes

```bash
npm test
```

Usam `node:test` + `supertest` contra o banco `caderno_de_campo_teste` (nunca tocam no banco da aplicação). Cobrem CRUD de talhão e insumo, código duplicado, validação, registrar/editar/excluir operação com acerto de estoque, estoque insuficiente, insumo em uso, exclusão de talhão devolvendo estoque, busca textual e as agregações.

## Recursos do MongoDB usados

| Recurso | Onde |
| --- | --- |
| `createCollection` com validador `$jsonSchema`, `collMod` | `scripts/setup-banco.js` |
| Índices: único, de texto, simples e em subdocumento | `scripts/setup-banco.js` |
| `insertOne`, `insertMany` | `src/repositorios/talhoes.js`, `insumos.js`, `scripts/seed.js` |
| `find` com filtro, projeção, `sort`, `skip`, `limit`; `findOne`; `countDocuments` | `talhoes.js`, `insumos.js` |
| `$text` com `textScore` | `listarTalhoes`, `listarInsumos` |
| `updateOne` com `$set`, `$unset`, `$push`, `$pull`, `$inc`, `arrayFilters` | `talhoes.js`, `insumos.js` |
| `deleteOne`, `findOneAndDelete` | `talhoes.js`, `insumos.js` |
| `aggregate`: `$group`, `$unwind`, `$sort`, `$limit`, `$lookup`, `$match`, `$avg`, `$expr` | `src/repositorios/relatorios.js` |
| `$collStats`, `listIndexes`, `listCollections` | `src/repositorios/banco.js` |

## Estrutura de pastas

```
src/
  app.js, servidor.js, db.js     app Express, porta, conexão
  repositorios/                  comandos do banco (talhoes, insumos, relatorios, banco)
  rotas/                         rotas Express por assunto
  validacao.js, formatar.js, erros.js
views/                           páginas EJS
public/                          CSS e JS (fontes e ícones vêm de node_modules, servidos localmente)
scripts/                         setup-banco.js e seed.js
test/                            testes automatizados
docker-compose.yml               mongo:8 + mongo-express
```

## Integrantes

- João Vinnycius Matos Monteiro Ferreira
- Mateus Robers Amaral

Professor: Joel Souza · Fatec Shunji Nishimura (Pompeia/SP) · 2026
