// Sobe o servidor HTTP na porta do .env (padrão 3415).
const { conectar } = require('./db');
const { criarApp } = require('./app');

const PORT = Number(process.env.PORT) || 3415;

conectar()
  .then(() => {
    criarApp().listen(PORT, () => console.log(`Caderno de Campo em http://localhost:${PORT}`));
  })
  .catch((erro) => {
    console.error('Não foi possível conectar ao MongoDB:', erro.message);
    console.error('Confira se o banco está ligado (npm run db:up) e a MONGODB_URI do .env.');
    process.exit(1);
  });
