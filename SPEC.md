# Caderno de Campo — atividade prática IAL-215 (Banco de Dados NoSQL)

## Enunciado (resumo fiel)

- Aplicação **CRUD**, tema livre, em Java, Node.js ou Python, com dados persistidos **obrigatoriamente em MongoDB**.
- Grupo de até 4 integrantes. Prazo: 16/11/2026. Entrega: relatório por e-mail ao prof. Joel Souza.
- O relatório precisa ter:
  1. prints do máximo de telas da aplicação funcionando;
  2. prints de evidências do uso dos recursos de persistência (**códigos e comandos**);
  3. prints de evidências do uso dos recursos de persistência (**base de dados**);
  4. link do GitHub com o código;
  5. identificação dos integrantes (obrigatório).
- No último dia o grupo apresenta a aplicação no laboratório.

## Decisões (já tomadas, não reabrir)

- **Tema:** "Caderno de Campo", o registro dos talhões de um sítio fictício (Sítio Santa Luzia, Pompeia/SP), das operações feitas em cada talhão (preparo de solo, plantio, adubação, pulverização, colheita) e do estoque de insumos. O curso é Big Data no Agronegócio.
- **Stack:** Node.js 22 + Express 5 + EJS (páginas renderizadas no servidor) + **driver oficial `mongodb`**, sem Mongoose. Os comandos do banco precisam aparecer explícitos no código (`insertOne`, `find`, `updateOne`, `$push`, `aggregate`…), porque viram evidência no relatório.
- **Banco local:** MongoDB 8 no Docker (`docker compose`), porta **27029** do host, ligado só em 127.0.0.1, sem autenticação (uso local de aula). Mais **mongo-express** na porta **8089** (127.0.0.1, sem basic auth), para mostrar a base no relatório. O `.env` aceita trocar por uma URI do Atlas.
- **Porta da aplicação:** 3415. Banco: `caderno_de_campo`. Banco dos testes: `caderno_de_campo_teste`.
- Tudo em **português do Brasil**: telas, mensagens, nomes de coleções e campos, comentários e README.
- Pasta do projeto: `~/Desktop/Desenvolvimento de Projetos/Projetos - Pessoais/estudos/ial215-caderno-de-campo/`. Repositório git local; **não fazer push nem criar repositório no GitHub** (isso fica com a sessão principal, depois do OK do usuário).

## Modelo de dados

### Coleção `insumos`
```js
{
  _id: ObjectId,
  nome: "Ureia 45% N",                 // obrigatório, 2–80 caracteres
  categoria: "fertilizante",           // semente | fertilizante | defensivo | corretivo
  fabricante: "Yara",                  // opcional
  unidade: "kg",                       // kg | L | sc
  estoque: 1200,                       // número >= 0, na unidade
  estoque_minimo: 300,                 // número >= 0
  preco_unitario: 3.4,                 // R$ por unidade, >= 0
  criado_em: Date, atualizado_em: Date
}
```

### Coleção `talhoes` (operações **embutidas**)
```js
{
  _id: ObjectId,
  codigo: "T01",                       // obrigatório, único (índice unique), formato T + 2 dígitos
  nome: "Baixada do Córrego",          // obrigatório
  cultura: "amendoim",                 // amendoim | milho | soja | cana-de-açúcar | café | pousio
  variedade: "IAC OL3",                // opcional
  area_ha: 18.5,                       // número > 0
  safra: "2026/27",                    // formato AAAA/AA
  status: "em andamento",              // planejado | em andamento | colhido
  tags: ["irrigado", "plantio direto"],// array de strings (pode ser vazio)
  operacoes: [                         // array de subdocumentos
    {
      _id: ObjectId,
      tipo: "adubação",                // preparo de solo | plantio | adubação | pulverização | colheita
      data: Date,
      insumo: { _id: ObjectId, nome: "Ureia 45% N", unidade: "kg", preco_unitario: 3.4 } | null,  // cópia (snapshot) do insumo
      dose_por_ha: 150 | null,
      quantidade_total: 2775 | null,   // dose_por_ha × area_ha, calculada no servidor
      produtividade_sc_ha: 62 | null,  // só em colheita
      responsavel: "João",
      observacao: ""
    }
  ],
  criado_em: Date, atualizado_em: Date
}
```

Por que embutir as operações: uma operação só existe dentro do talhão e é sempre lida junto com ele (é o "schema design" do capítulo 4 do livro da disciplina). O insumo fica em coleção própria porque tem estoque e é compartilhado entre talhões; dentro da operação vai uma cópia dos campos que precisam ficar congelados no tempo (nome, unidade, preço do dia).

### Regras de negócio
- Registrar uma operação com insumo: `$push` no array do talhão e `$inc: { estoque: -quantidade_total }` no insumo. Excluir a operação devolve o estoque (`$inc` positivo). Estoque não pode ficar negativo: se a quantidade passar do estoque, recusar com mensagem clara.
- Editar uma operação: atualizar o subdocumento com o operador posicional (`"operacoes.$[op]"` + `arrayFilters`) e acertar a diferença de estoque.
- Excluir talhão: apaga o documento (as operações vão junto) e **devolve ao estoque** os insumos das operações dele.
- Excluir insumo: recusar se alguma operação o usa (consulta em `operacoes.insumo._id`), mostrando quantos talhões usam.
- Código do talhão duplicado (erro 11000): mensagem "Já existe um talhão com o código T0X".

### Recursos do MongoDB que precisam aparecer (cada um vira evidência)
- `createCollection` com **validador `$jsonSchema`** nas duas coleções (script `npm run db:setup`); erro 121 tratado com mensagem amigável.
- Índices: `talhoes.codigo` (unique), índice de **texto** em talhões (`nome`, `variedade`, `tags`) e em insumos (`nome`, `fabricante`), `talhoes.cultura`, `talhoes.operacoes.data`, `insumos.categoria`.
- CRUD: `insertOne`, `insertMany` (seed), `find` com filtro + projeção + `sort` + `skip`/`limit`, `findOne`, `countDocuments`, `updateOne` com `$set`, `$push`, `$pull`, `$inc`, `arrayFilters`, `deleteOne`.
- Busca textual com `$text` e ordenação por `textScore`.
- **Agregações** (`aggregate`): área total por cultura (`$group`), operações por tipo (`$unwind` + `$group`), últimas operações (`$unwind` + `$sort` + `$limit`), custo estimado de insumos por talhão (`$unwind` + `$group` + `$lookup` em `insumos` para trazer a categoria), produtividade média por cultura (`$match` em colheita + `$group` + `$avg`), insumos abaixo do estoque mínimo (`$expr`).

## Telas

Layout: barra lateral fixa em bloco verde com o nome "Caderno de Campo" e o menu (Painel, Talhões, Insumos, Relatórios, Banco de dados); conteúdo à direita. No celular, a barra vira topo.

1. **`/` Painel:** 4 números (talhões, área total em ha, operações registradas, insumos abaixo do mínimo), área por cultura em barras horizontais feitas em CSS, últimas 8 operações, insumos com estoque baixo.
2. **`/talhoes`:** tabela com código, nome, cultura, área, safra, status, nº de operações; filtros por cultura e status, busca textual (`q`), ordenação (código, área, nome) e paginação (8 por página). Botão "Novo talhão".
3. **`/talhoes/novo`** e **`/talhoes/:id/editar`:** formulário com validação no servidor; os erros voltam ao lado do campo, sem perder o que foi digitado.
4. **`/talhoes/:id`:** ficha do talhão, linha do tempo das operações (mais recente primeiro), formulário "Registrar operação" (o insumo é escolhido de um `<select>` com os insumos do banco; o campo produtividade aparece com o tipo colheita, via JS simples), editar e excluir operação. Um bloco recolhível "Documento no MongoDB" mostra o JSON do documento como está gravado (EJSON relaxado, indentado).
5. **`/talhoes/:id/excluir`:** página de confirmação (GET) e exclusão (POST). **Nada de `confirm()`/`alert()` em JavaScript.**
6. **`/insumos`:** tabela com filtro por categoria, "só estoque baixo" e busca textual; estoque abaixo do mínimo destacado. **`/insumos/novo`**, **`/insumos/:id/editar`**, **`/insumos/:id/excluir`** (com a recusa quando está em uso).
7. **`/relatorios`:** as agregações em tabelas e barras (custo por talhão, operações por tipo, produtividade por cultura), cada uma com um "ver pipeline" recolhível que mostra o pipeline usado.
8. **`/banco`:** coleções com `countDocuments`, tamanho (`$collStats` ou `db.command({ collStats })`, o que funcionar no Mongo 8), índices (`listIndexes`), o validador (`listCollections`) e um documento de exemplo de cada coleção. Serve de evidência ao vivo.
9. **Mensagens:** depois de criar, editar ou excluir, voltar com uma faixa de confirmação ("Talhão T09 criado"). Página 404 e de erro 500 com o mesmo layout.

Formatação brasileira: números com vírgula decimal (`18,5 ha`), datas `dd/mm/aaaa`, moeda `R$ 1.234,56` (`Intl`).

## Visual (tema claro)

- Fundo papel `#f6f4ee`, texto `#1c2a1f`, verde do bloco lateral `#1f5130`, verde de ação `#2f7a43`, âmbar de alerta `#b7791f`, vermelho de exclusão `#a8382a`, linhas `#e2ded3`, cartões brancos.
- Fontes **IBM Plex Sans** e **IBM Plex Mono** (JSON, códigos de talhão, números de tabela), instaladas por `@fontsource` e servidas localmente: o laboratório pode estar sem internet.
- Ícones **Phosphor no estilo fill** (`@phosphor-icons/web`, servido localmente). Sem emoji.
- Cara de caderno de campo de verdade, não de template de IA: título grande em cada página, cor em blocos sólidos (barra lateral, etiqueta de cultura com cor própria por cultura), tabelas limpas, sem gradiente, sem sombra exagerada, sem cartão dentro de cartão.
- Precisa caber bem em 1440×900 (é o tamanho dos prints).

## Estrutura de pastas

```
ial215-caderno-de-campo/
  SPEC.md
  README.md                 # o que é, como rodar (passo a passo do zero), prints principais, integrantes
  package.json              # scripts abaixo
  docker-compose.yml        # mongo:8 (27029) + mongo-express (8089)
  .env.example  .gitignore
  src/
    app.js                  # cria o app Express (exportado para os testes)
    servidor.js             # sobe na PORT
    db.js                   # MongoClient, conectar(), getDb(), fechar()
    repositorios/
      talhoes.js            # todas as operações do banco sobre talhões e operações embutidas
      insumos.js
      relatorios.js         # pipelines de agregação (exportados também como constantes, para a tela mostrar)
      banco.js              # estatísticas, índices, validadores
    rotas/                  # talhoes.js, insumos.js, painel.js, relatorios.js, banco.js
    validacao.js            # validação dos formulários
    formatar.js             # Intl pt-BR
  views/                    # EJS: layout/partials + páginas
  public/                   # css/app.css, js/ (só o mínimo), fontes e ícones copiados
  scripts/
    setup-banco.js          # createCollection + $jsonSchema + índices (idempotente: collMod se já existir)
    seed.js                 # apaga e recria: 12 insumos, 8 talhões, ~45 operações coerentes com o estoque
  test/                     # node:test + supertest contra o banco de teste
  docs/
    comandos-mongosh.js     # os mesmos recursos rodados direto no mongosh (evidência de comandos)
  relatorio/                # (outra frente) gerador do relatório em PDF
```

Scripts do `package.json`: `db:up` (`docker compose up -d`), `db:down`, `db:setup`, `db:seed` (roda o setup antes), `start`, `dev` (`node --watch`), `test`.

## Regras para quem constrói

- Rodar e conferir de verdade: `npm run db:up && npm run db:seed && npm test` verdes, e cada tela aberta sem erro.
- Comentários curtos em português, só onde o porquê não é óbvio. Código legível por estudante: funções pequenas, nomes em português.
- Nada de segredo no git (`.env` no `.gitignore`).
- Commits pequenos e descritivos em português no repositório local. Sem push.
