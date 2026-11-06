const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

let latestQR = '';

// Ana Sayfa
app.get('/', (req, res) => {
  res.send(`
    <h2>WhatsApp Bot Aktif! 🚀</h2>
    <p>Botun QR kodunu taratmak için <a href="/qr"><b>/qr sayfasına gidin</b></a>.</p>
  `);
});

// Web üzerinden QR Kodu Gösterme Sayfası
app.get('/qr', async (req, res) => {
  if (!latestQR) {
    return res.send(`
      <h3>Henüz QR kod üretilmedi veya bot zaten bağlı!</h3>
      <p>Eğer bot bağlı değilse sayfayı birkaç saniye sonra yenileyin.</p>
      <script>setTimeout(() => location.reload(), 3000);</script>
    `);
  }
  try {
    const qrImageURL = await qrcode.toDataURL(latestQR);
    res.send(`
      <div style="text-align: center; margin-top: 50px;">
        <h2>WhatsApp QR Kodunu Okutun</h2>
        <img src="${qrImageURL}" alt="WhatsApp QR Code" style="width: 300px; height: 300px;"/>
        <p>Bu sayfa her 5 saniyede bir güncellenir.</p>
      </div>
      <script>setTimeout(() => location.reload(), 5000);</script>
    `);
  } catch (err) {
    res.send('QR kod oluşturulurken bir hata oluştu.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// --- WhatsApp Baileys Bot Mantığı ---
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log('📌 Yeni QR Kod üretildi! /qr adresinden taratabilirsiniz.');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Bağlantı kapandı, yeniden bağlanılıyor: ', shouldReconnect);
      
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp botu başarıyla bağlandı!');
      latestQR = ''; // Bağlanınca QR'ı sıfırla
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const messageContent = m.message.conversation || m.message.extendedTextMessage?.text;
    const sender = m.key.remoteJid;

    console.log(`Gelen mesaj: ${messageContent} (${sender})`);

    if (messageContent && messageContent.toLowerCase() === 'merhaba') {
      await sock.sendMessage(sender, { text: 'Merhaba! Bot aktif ve çalışıyor.' });
    }
  });
}

connectToWhatsApp().catch((err) => console.log('Bot başlatılırken hata oluştu: ', err));
