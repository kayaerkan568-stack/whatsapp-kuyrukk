const { default: makeWASocket, useMultiFileAuthState, jidNormalizedUser } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyKbO7fdkK7rZ4G1TvT4rQs3PMuVgcyUfQV0EWlo_hNm_RRZ-l1xlzRJkCRiQwzxg/exec';

async function startBot() {
    console.log("Oturum bulutta baslatiliyor, lutfen bekleyin...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Windows", "Chrome", "121.0.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n--- RENDER LOGLARINDAKI WHATSAPP KAREKODU ---");
            qrcode.generate(qr, { small: true });
            console.log("\nRender log ekranındaki bu karekodu telefonunuzdan (WhatsApp > Bağlı Cihazlar > Cihaz Bağla) taratın.\n");
        }

        if (connection === 'open') {
            console.log('\n[✔] WhatsApp BULUTTA BAGLANDI! Canli kuyruk aktif...\n');
            baslatKuyruk(sock);
        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`[!] Baglanti kapandi (Kod: ${statusCode}), yeniden baglaniliyor...`);
            setTimeout(startBot, 5000);
        }
    });
}

function baslatKuyruk(sock) {
    const islenenSatirlar = new Set();

    setInterval(async () => {
        try {
            const response = await axios.get(SCRIPT_URL, { timeout: 10000 });
            let gorevler = response.data;

            if (!Array.isArray(gorevler) || gorevler.length === 0) return;

            const simdi = new Date();

            for (let i = 0; i < gorevler.length; i++) {
                const gorev = gorevler[i];

                if (gorev.durum === "GÖNDERİLDİ") continue;

                const hedefZaman = new Date(gorev.zaman);

                if (simdi >= hedefZaman && !islenenSatirlar.has(gorev.satir)) {
                    try {
                        const hedefJid = jidNormalizedUser(gorev.jid);
                        const kisiAdi = gorev.kisi || "Biri";

                        islenenSatirlar.add(gorev.satir);

                        await sock.sendMessage(hedefJid, { text: gorev.mesaj });
                        console.log(`[>] METIN GONDERILDI -> ${kisiAdi} (${hedefJid})`);

                        await axios.post(SCRIPT_URL, JSON.stringify({
                            satir: gorev.satir,
                            durum: "GÖNDERİLDİ"
                        }), { timeout: 10000 });

                    } catch (error) {
                        console.log("[!] Gonderim hatasi:", error.message);
                    }
                }
            }
        } catch (e) {
            // Ağ veya tablo gecikmelerinde botun çökmesini tamamen engeller
        }
    }, 5000);
}

startBot();