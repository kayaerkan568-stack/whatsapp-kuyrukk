const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// 1. Render'ın port isteğini karşılamak için mini web sunucusu
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('WhatsApp Bot Aktif ve Calisiyor!');
});

app.listen(PORT, () => {
    console.log(`Web sunucusu ${PORT} portunda calisiyor.`);
});

// 2. WhatsApp Bot Başlangıç Fonksiyonu
async function startSock() {
    // Oturum klasörünü sabitliyoruz
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }), // Gereksiz log kirliliğini önler
        browser: ["Windows", "Chrome", "10.0"] // Oturumun düşmesini engeller
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📌 Yeni QR Kod üretildi, lütfen telefonunuzdan okutun.');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`[!] Bağlantı kapandı (Kod: ${statusCode}), yeniden bağlanılıyor...`);

            // Kod 500 veya kopmalarda anında döngüye girmemek için 5 sn bekleyip başlatıyoruz
            setTimeout(() => {
                startSock();
            }, 5000);
        } else if (connection === 'open') {
            console.log('[✔] WhatsApp BULUTTA BAGLANDI! Canli kuyruk aktif...');
        }
    });

    // Mesaj veya kuyruk işlemlerini buraya ekleyebilirsin
}

startSock();
