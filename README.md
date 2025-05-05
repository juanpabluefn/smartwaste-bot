# SmartWaste Bot

Este es el MVP de un bot de WhatsApp para la recolección de residuos.

## Archivos principales

- `app.js`: servidor Express con lógica de webhook y cron.
- `horarios.json`: lista de colonias y horarios de paso.
- `.env`: variables de entorno (no incluido en repositorio).
- `package.json`: dependencias y scripts.

## Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tuUsuario/smartwaste-bot.git
   cd smartwaste-bot
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Crear `.env`** con:
   ```
   PORT=3000
   TWILIO_ACCOUNT_SID=tuAccountSid
   TWILIO_AUTH_TOKEN=tuAuthToken
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   MONGO_URI="mongodb+srv://botuser:voctu9-woqgav-mejHuj@cluster0.5t6b6x2.mongodb.net/smartwaste?retryWrites=true&w=majority"
   ```

4. **Ejecutar**:
   ```bash
   npm start
   ```

## Uso

- Envía `LLENO` o `#Escombro` al número de WhatsApp del sandbox.
- Recibirás confirmaciones y los reportes se guardarán en MongoDB Atlas.
- A las 07:00 h se enviarán avisos de ruta basados en `horarios.json`.
