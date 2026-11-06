const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON verilerini okuyabilmek için middleware
app.use(express.json());

let sock; // WhatsApp soket bağlantısı

app.get('/', (req, res) => {
  res.send('WhatsApp Bot is running and healthy!');
});

// Google Sheets'ten mesaj tetiklemek için API Endpoint
app.post('/send-message', async (req, res) => {
  const { phone, message, secretKey } = req.body;

  // Güvenlik Anahtarı Kontrolü (İsteğe bağlı, güvenlik için "mysecret123" belirledik)
  if (secretKey !== "mysecret123") {
    return res.status(401).json({ success: false, error: "Yetkisiz erişim!" });
  }

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: "Telefon numarası ve mesaj zorunludur." });
  }

  if (!sock || !sock.user) {
    return res.status(503).json({ success: false, error: "WhatsApp botu şu an bağlı değil." });
  }

  try {
    // Telefon numarasını WhatsApp jid formatına dönüştürme (Örn: 905XXXXXXXXX@s.whatsapp.net)
    let formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '90' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('90') && formattedPhone.length === 10) {
      formattedPhone = '90' + formattedPhone;
    }
    const jid = `${formattedPhone}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: message });
    console.log(`📤 Mesaj gönderildi -> ${phone}: ${message}`);
    
    return res.json({ success: true, message: "Mesaj başarıyla iletildi." });
  } catch (err) {
    console.error("Mesaj gönderme hatası:", err);
    return res.status(500).json({ success: false, error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Chrome')
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = "905342383008"; 
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`🔑 WHATSAPP EŞLEŞTİRME KODUNUZ: ${code}`);
      } catch (err) {
        console.log('Eşleştirme kodu alınamadı:', err);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

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

    if (messageContent && messageContent.toLowerCase() === 'merhaba') {
      await sock.sendMessage(sender, { text: 'Merhaba! Bot aktif ve çalışıyor.' });
    }
  });
}

connectToWhatsApp().catch((err) => console.log('Bot başlatılırken hata oluştu: ', err));
