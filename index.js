const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    if (!sock.authState.creds.registered) {
        // Süreyi 6 saniyeye çıkarıyoruz ki bağlantı tamamen kurulsun
        setTimeout(async () => {
            try {
                const phoneNumber = "+905342383008";
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n========================================`);
                let gelenKod = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`WHATSAPP EŞLEŞTİRME KODUNUZ: ${gelenKod}`);
                console.log(`========================================\n`);
            } catch (error) {
                console.log("Eşleştirme kodu alınırken hata oluştu:", error);
            }
        }, 6000);
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
