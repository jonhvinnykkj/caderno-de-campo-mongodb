// Lista das figuras do relatório: arquivo, legenda e a frase que explica o que a imagem mostra.
// Se o arquivo da imagem não existir, o gerador de PDF usa um quadro cinza provisório.

export const TELAS = [
  { arquivo: '01-painel.png', legenda: 'Painel inicial', texto: 'Resumo da propriedade: quantidade de talhões, área total, operações registradas e insumos abaixo do mínimo, com a área por cultura e as últimas operações.' },
  { arquivo: '02-talhoes-lista.png', legenda: 'Lista de talhões', texto: 'Lista paginada: cada talhão é uma ficha com a lombada na cor da cultura, o código, a área, a safra, o status e o número de operações.' },
  { arquivo: '03-talhoes-filtro.png', legenda: 'Lista filtrada por cultura', texto: 'O filtro por cultura e status monta o filtro do find e mostra só os talhões correspondentes.' },
  { arquivo: '04-talhoes-busca.png', legenda: 'Busca textual de talhões', texto: 'A busca usa o índice de texto (operador $text) sobre nome, variedade e tags.' },
  { arquivo: '05-talhao-novo-vazio.png', legenda: 'Formulário de novo talhão', texto: 'Formulário de cadastro, ainda vazio.' },
  { arquivo: '06-talhao-erro.png', legenda: 'Erros de validação no cadastro', texto: 'Dados inválidos são recusados pelo servidor e os erros aparecem ao lado de cada campo, sem perder o que foi digitado.' },
  { arquivo: '07-talhao-preenchido.png', legenda: 'Formulário preenchido', texto: 'Cadastro de um talhão de demonstração com os dados válidos.' },
  { arquivo: '08-talhao-criado.png', legenda: 'Confirmação de talhão criado', texto: 'Depois do insertOne, a aplicação abre a ficha do talhão criado, com a faixa de confirmação no topo.' },
  { arquivo: '09-talhao-ficha.png', legenda: 'Ficha do talhão', texto: 'Dados do talhão e linha do tempo das operações embutidas no documento, da mais recente para a mais antiga.' },
  { arquivo: '10-operacao-registrar.png', legenda: 'Registro de operação', texto: 'Formulário de operação com o insumo escolhido entre os cadastrados; a quantidade total é calculada no servidor.' },
  { arquivo: '11-operacao-registrada.png', legenda: 'Operação registrada', texto: 'A operação entra no array do talhão com $push e o estoque do insumo é reduzido com $inc.' },
  { arquivo: '21-operacao-editar.png', legenda: 'Edição de operação', texto: 'A dose é alterada pelo operador posicional com arrayFilters, e a diferença de estoque é acertada no insumo.' },
  { arquivo: '22-operacao-excluir.png', legenda: 'Confirmação de exclusão de operação', texto: 'A operação sai do array com $pull e a quantidade usada volta ao estoque do insumo.' },
  { arquivo: '13-talhao-editar.png', legenda: 'Edição do talhão', texto: 'Formulário de edição com os valores atuais, gravados com updateOne e $set.' },
  { arquivo: '14-talhao-excluir.png', legenda: 'Confirmação de exclusão', texto: 'A exclusão pede confirmação em uma página própria; ao excluir, os insumos das operações voltam ao estoque.' },
  { arquivo: '15-insumos.png', legenda: 'Lista de insumos', texto: 'Estoque dos insumos com filtro por categoria; o que está abaixo do mínimo aparece destacado.' },
  { arquivo: '16-insumos-baixo.png', legenda: 'Insumos com estoque baixo', texto: 'Filtro que usa $expr para comparar o estoque com o estoque mínimo do próprio documento.' },
  { arquivo: '17-insumo-em-uso.png', legenda: 'Exclusão de insumo recusada', texto: 'Um insumo usado em operações não pode ser excluído; a tela informa em quantos talhões ele aparece.' },
  { arquivo: '18-relatorios-1.png', legenda: 'Relatórios: custo estimado por talhão', texto: 'Resultado da agregação com $unwind, $lookup e $group, em tabela e barras por categoria de insumo.' },
  { arquivo: '18-relatorios-2.png', legenda: 'Relatórios com um pipeline aberto', texto: 'Operações por tipo e produtividade média; o bloco “Ver pipeline” mostra o pipeline usado no aggregate.' },
  { arquivo: '19-celular.png', legenda: 'Tela em largura de celular', texto: 'Visão em 390 px de largura, com a barra lateral no topo da página.', retrato: true },
];

export const BANCO = [
  { arquivo: '12-talhao-documento.png', legenda: 'Documento do talhão como está gravado', texto: 'Bloco “Documento no MongoDB” da ficha, com o JSON do talhão e as operações embutidas.' },
  { arquivo: '20-banco-app-1.png', legenda: 'Tela “Banco de dados”: coleção talhoes', texto: 'Contagem de documentos, tamanho, índices e validador, lidos ao vivo do MongoDB.' },
  { arquivo: '20-banco-app-2.png', legenda: 'Tela “Banco de dados”: coleção insumos', texto: 'Os mesmos dados da coleção insumos, com índices, validador e um documento de exemplo.' },
  { arquivo: 'me-1-bancos.png', legenda: 'mongo-express: lista de bancos', texto: 'O banco caderno_de_campo criado no MongoDB que roda no Docker.' },
  { arquivo: 'me-2-banco.png', legenda: 'mongo-express: coleções do banco', texto: 'As duas coleções do banco: insumos e talhoes.' },
  { arquivo: 'me-3-talhoes.png', legenda: 'mongo-express: coleção talhoes', texto: 'Os talhões gravados, com o array operacoes embutido em cada documento.' },
  { arquivo: 'me-4-documento.png', legenda: 'mongo-express: um documento aberto', texto: 'Documento de um talhão com o array operacoes embutido.' },
  { arquivo: 'me-5-insumos.png', legenda: 'mongo-express: coleção insumos', texto: 'Documentos da coleção insumos, com estoque, estoque mínimo e preço unitário.' },
];
