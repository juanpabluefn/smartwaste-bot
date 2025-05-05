// app.js
require('dotenv').config();

const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const Twilio = require('twilio');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

// Carga de datos estáticos
const colonias = require('./colonias.json');      // Lista de puntos con id,nombre,lat,lon
const horarios = require('./horarios.json');      // [{ colonia, hora }, …]

// (tras const horarios = require('./horarios.json'); etc.)

app.post('/whatsapp', async (req, res) => {
  const twiml = new MessagingResponse();
  const from = req.body.From;
  const msg = (req.body.Body||'').trim();

  // 1) Si viene ubicación
  if (req.body.Latitude && req.body.Longitude) {
    const lat = parseFloat(req.body.Latitude);
    const lon = parseFloat(req.body.Longitude);
    const resultado = findNearestColonia(lat, lon);

    if (!resultado) {
      twiml.message('❌ Estás fuera de la zona de servicio (Santiago ±1 km).');
    } else {
      const { nombre: colonia, distancia } = resultado;
      // Guardar colonia en users
      await db.collection('users').updateOne(
        { user: from },
        { $set: { colonia } },
        { upsert: true }
      );

      // Buscar horario
      const entry = horarios.find(h => h.colonia === colonia);
      const hora = entry ? entry.hora : 'sin horario disponible';

      twiml.message(
        `📍 Ubicación asociada a *${colonia}* (a ${distancia.toFixed(2)} km).\n` +
        `🗑️ Hoy tu camión pasará por allí a las *${hora}*.`
      );
    }
  }
  // 2) Procesar reporte
  else if (msg.toUpperCase() === 'LLENO' || msg.toUpperCase() === '#ESCOMBRO') {
    // ... tu lógica actual ...
  }
  else {
    // ... ayuda ...
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

// Inicializa Twilio REST client
const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Expresa y puerto
const app = express();
app.use(express.urlencoded({ extended: false }));

// Conexión a MongoDB Atlas
let db;
MongoClient.connect(process.env.MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db('smartwaste');
    console.log('✅ Conectado a MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ Error conectando a MongoDB Atlas:', err.message);
    process.exit(1);
  });

/**
 * Haversine para calcular distancia en km
 */
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Encuentra la colonia más cercana dentro de maxKm
 */
function findNearestColonia(lat, lon, maxKm = 1) {
  let minDist = Infinity, nearest = null;
  for (let c of colonias) {
    const d = haversine(lat, lon, c.lat, c.lon);
    if (d < minDist) {
      minDist = d;
      nearest = c.nombre;
    }
  }
  return (minDist <= maxKm) ? nearest : null;
}

/**
 * Webhook que procesa mensajes entrantes de WhatsApp
 */
app.post('/whatsapp', async (req, res) => {
  const twiml = new MessagingResponse();
  const from = req.body.From;                 // p.ej. "whatsapp:+521XXXXXXXXXX"
  const msg = (req.body.Body || '').trim().toUpperCase();

  // 1) Si el mensaje incluye latitud/longitud → registro de ubicación
  if (req.body.Latitude && req.body.Longitude) {
    const lat = parseFloat(req.body.Latitude);
    const lon = parseFloat(req.body.Longitude);
    const colonia = findNearestColonia(lat, lon);
    if (colonia) {
      await db.collection('users').updateOne(
        { user: from },
        { $set: { colonia } },
        { upsert: true }
      );
      twiml.message(`📍 Ubicación registrada: tu colonia es *${colonia}*. Ahora envía "LLENO" para reportar.`);
    } else {
      twiml.message('❌ Fuera del área de servicio (1 km de Santiago). Por favor, comparte ubicación cerca de Barrio de Santiago.');
    }
  }
  // 2) Si envía reporte de lleno o escombro
  else if (msg === 'LLENO' || msg === '#ESCOMBRO') {
    const user = await db.collection('users').findOne({ user: from });
    if (!user || !user.colonia) {
      twiml.message('❗ Primero envía tu ubicación (clip ▶️ Ubicación) para registrar tu colonia.');
    } else {
      await db.collection('reports').insertOne({
        user: from,
        colonia: user.colonia,
        tipo: (msg === 'LLENO') ? 'LLENO' : 'ESCOMBRO',
        fecha: new Date()
      });
      twiml.message(`✅ Reporte "${msg.replace('#','')}" recibido para *${user.colonia}*.`);
    }
  }
  // 3) Mensaje desconocido
  else {
    twiml.message(
      '🤖 Comandos disponibles:\n' +
      '1) Enviar tu ubicación (clip ▶️ Ubicación).\n' +
      '2) Luego enviar "LLENO" o "#Escombro".'
    );
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

/**
 * Cron diario a las 04:00 que programa los avisos según horarios.json
 */
cron.schedule('0 4 * * *', async () => {
  console.log('⏰ Iniciando programación de avisos diarios...');

  // 1) Carga todos los usuarios con colonia
  const usuarios = await db.collection('users').find().toArray();

  // 2) Para cada entrada en horarios.json, crea un cron job interno
  horarios.forEach(({ colonia, hora }) => {
    const [H, M] = hora.split(':');
    cron.schedule(`${M} ${H} * * *`, async () => {
      // Filtra usuarios de esta colonia
      const vecinos = usuarios.filter(u => u.colonia === colonia);
      for (let vecino of vecinos) {
        try {
          await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: vecino.user,
            body: `🗑️ Hoy tu camión pasará por *${colonia}* a las *${hora}*.`
          });
          console.log(`✔️ Aviso enviado a ${vecino.user} para ${colonia} a las ${hora}`);
        } catch (err) {
          console.error(`❌ Error enviando a ${vecino.user}:`, err.message);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SmartWaste Bot en línea en puerto ${PORT}`);
});
