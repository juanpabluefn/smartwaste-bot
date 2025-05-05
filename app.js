require('dotenv').config();
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const twilio = require('twilio');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const horarios = require('./horarios.json');

const app = express();
app.use(express.urlencoded({ extended: false }));

// Conectar a MongoDB Atlas
let db;
MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(client => {
    db = client.db('smartwaste');
    console.log('✅ Conectado a MongoDB Atlas');
    db.createCollection('routes').catch(()=>{});
    db.createCollection('reports').catch(()=>{});
  })
  .catch(err => console.error('Error MongoDB:', err));

// Webhook para WhatsApp
app.post('/whatsapp', async (req, res) => {
  const twiml = new MessagingResponse();
  const msg  = (req.body.Body||'').trim().toUpperCase();
  const from = req.body.From;

  if (msg === 'LLENO') {
    await db.collection('reports').insertOne({ tipo:'LLENO', user:from, fecha:new Date() });
    twiml.message('✅ Reporte LLENO recibido.');
  } else if (msg === '#ESCOMBRO') {
    await db.collection('reports').insertOne({ tipo:'ESCOMBRO', user:from, fecha:new Date() });
    twiml.message('🚧 Solicitud de escombro recibida.');
  } else {
    twiml.message('🤖 Comando no válido. Envía LLENO o #Escombro');
  }

  res.writeHead(200, {'Content-Type':'text/xml'});
  res.end(twiml.toString());
});

// Cron: avisos diarios 07:00
cron.schedule('0 7 * * *', () => {
  horarios.forEach(async ({ colonia, hora }) => {
    await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      .messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to:   'whatsapp:+52TU_NUMERO_DE_PRUEBA',
        body: `🗑️ Tu camión pasará por ${colonia} a las ${hora} h.`
      });
    console.log('Aviso enviado:', colonia, hora);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot corriendo en puerto ${PORT}`));
