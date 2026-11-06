const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');

// --- Render Port Bind Gereksinimi İçin Express Sunucusu ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('WhatsApp Bot is running and healthy!');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// --- WhatsApp Baileys Bot Mantığı ---
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📌 Yeni QR Kod üretildi, lütfen telefonunuzdan okutun.');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Bağlantı kapandı, yeniden bağlanılıyor: ', shouldReconnect);
      
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp botu başarıyla bağlandı!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const messageContent = m.message.conversation || m.message.extendedTextMessage?.text;
    const sender = m.key.remoteJid;

    console.log(`Gelen mesaj: ${messageContent} (${sender})`);

    // Örnek otomatik yanıt
    if (messageContent && messageContent.toLowerCase() === 'merhaba') {
      await sock.sendMessage(sender, { text: 'Merhaba! Bot aktif ve çalışıyor.' });
    }
  });
}

connectToWhatsApp().catch((err) => console.log('Bot başlatılırken hata oluştu: ', err));
