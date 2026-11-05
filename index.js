const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startSock() {
    // Oturum klasörünü auth_info_baileys olarak sabitliyoruz
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }), // Gereksiz log kirliliğini ve hata şişmesini önler
        browser: ["Windows", "Chrome", "10.0"] // WhatsApp'ın oturumu yabancı cihaz olarak görüp düşürmesini engeller
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

            // Kod 500 veya çakışmalarda anında döngüye girmemek için 5 sn bekleyip taze başlatıyoruz
            setTimeout(() => {
                startSock();
            }, 5000);
        } else if (connection === 'open') {
            console.log('[✔] WhatsApp BAĞLANDI! Canlı kuyruk aktif...');
        }
    });
}

startSock();
