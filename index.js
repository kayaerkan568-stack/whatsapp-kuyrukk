const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("\n========================================");
            console.log("Lütfen aşağıdaki QR kodu telefonunuzla taratın:");
            console.log("========================================\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Bağlantı koptu, yeniden bağlanılıyor...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[✔] WhatsApp BULUTTA BAGLANDI!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Google Sheets'ten gelen istekleri karşılayan API Endpoint
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    
    if (!sock) {
        return res.status(500).json({ status: 'error', error: 'WhatsApp botu henüz hazır değil.' });
    }

    try {
        const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.status(200).json({ status: 'success', message: 'Mesaj başarıyla gönderildi!' });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
    connectToWhatsApp();
});
