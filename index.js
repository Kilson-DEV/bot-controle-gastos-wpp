require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const mongoose = require('mongoose');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error('Erro ao conectar MongoDB', err));

// Esquema de gastos
const gastoSchema = new mongoose.Schema({
  user: String,
  description: String,
  amount: Number,
  date: { type: Date, default: Date.now }
});

const Gasto = mongoose.model('Gasto', gastoSchema);

// Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Bot pronto!');
});

client.on('message', async message => {
  const from = message.from.replace('@c.us', '');
  const body = message.body.trim();

  // Verifica se é admin
  const isAdmin = from === process.env.ADMIN_NUMBER;

  if (body.startsWith('/compra')) {
    const parts = body.split(' ');
    const amount = parseFloat(parts[1]);
    const description = parts.slice(2).join(' ');

    if (!amount || !description) {
      return message.reply('Formato errado. Use: /compra 100 camisa');
    }

    const gasto = new Gasto({
      user: from,
      description,
      amount
    });

    await gasto.save();
    await message.reply(`✅ Compra registrada: ${description} - ${amount} MZN`);
  }

  else if (body.startsWith('/total')) {
    const gastos = await Gasto.find({ user: from });
    const total = gastos.reduce((sum, g) => sum + g.amount, 0);

    await message.reply(`💵 Total gasto: ${total} MZN\nDesde: ${gastos[0]?.date.toLocaleDateString() || 'sem registros'}`);
  }

  else if (body.startsWith('/gastosmes')) {
    const now = new Date();
    const gastos = await Gasto.find({
      user: from,
      date: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
    });

    const total = gastos.reduce((sum, g) => sum + g.amount, 0);

    await message.reply(`📅 Total deste mês: ${total} MZN`);
  }

  else if (!isAdmin) {
    await message.reply(`🚫 Você não está autorizado. Fale com o dono: ${process.env.ADMIN_NUMBER}`);
  }
});

client.initialize();

// Endpoint básico para railway
app.get('/', (req, res) => {
  res.send('Bot de Controle de Gastos Online!');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
