const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // QR kodu kapatıyoruz
        logger: pino({ level: 'silent' })
    });

    // Eğer daha önce bağlanmadıysa eşleştirme kodu isteyelim
    if (!sock.authState.creds.registered) {
        const phoneNumber = "+905XXXXXXXXX"; // BURAYA KENDİ TELEFON NUMARANI YAZ (Örnek: +905321234567)
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n========================================`);
            gelenKod = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`WHATSAPP EŞLEŞTİRME KODUNUZ: ${gelenKod}`);
            console.log(`========================================\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
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
}

connectToWhatsApp();
