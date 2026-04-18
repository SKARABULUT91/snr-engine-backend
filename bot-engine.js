import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Stealth eklentisini aktif et (Bot olduğumuzu gizleyen zırh)
puppeteer.use(StealthPlugin());

/**
 * SNR ENGINE - Ana Bot Fonksiyonu
 * @param {string} targetUrl - Hedef Twitter/X sayfası
 * @param {object} proxyData - Vekil sayfasından gelen {host, port, user, pass}
 */
export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const launchOptions = {
        headless: "new", // Arka planda çalışır
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=WebRtcHideLocalIpsWithMdns', // IP Sızıntısını önler
        ]
    };

    // 1. ADIM: EĞER PROXY VARSA ENJEKTE ET
    if (proxyData && proxyData.host) {
        console.log(`[PROXY] SOCKS5 Bağlantısı Kuruluyor: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    
    try {
        const page = await browser.newPage();

        // 2. ADIM: PROXY KİMLİK DOĞRULAMA (USER/PASS VARSA)
        if (proxyData?.user && proxyData?.pass) {
            await page.authenticate({
                username: proxyData.user,
                password: proxyData.pass
            });
        }

        // 3. ADIM: RASTGELE KİMLİK (USER-AGENT) SEÇİMİ
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        
        // Ekran çözünürlüğünü ayarla
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`[NAVIGATE] Hedefe gidiliyor: ${targetUrl}`);
        
        // Sayfaya git ve yüklenmesini bekle
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 4. ADIM: REKLAM TESPİTİ VE DURAKLAMA (SIMÜLASYON)
        console.log("[SCAN] Reklamlar aranıyor...");
        
        // Twitter reklamlarını (tweet görünümlü) yakala
        const tweets = await page.$$('article[data-testid="tweet"]');

        for (let i = 0; i < Math.min(tweets.length, 10); i++) {
            const tweet = tweets[i];
            
            // Reklam olup olmadığını metin üzerinden kontrol et
            const isAd = await tweet.evaluate(el => 
                el.innerText.includes('Promoted') || 
                el.innerText.includes('Sponsorlu') || 
                el.innerText.includes('Reklam')
            );

            if (isAd) {
                console.log(`[AD FOUND] Reklam tespit edildi! Odaklanılıyor...`);
                
                // Reklama yavaşça kaydır (İnsan gibi)
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));

                // --- SENİN 2 SANİYE KURALIN (Rastgelelik ile) ---
                const waitTime = Math.floor(Math.random() * (2600 - 1900 + 1) + 1900);
                console.log(`[WAIT] Reklam üzerinde duruluyor: ${waitTime}ms`);
                
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Etkileşimi artırmak için minik bir mouse hareketi simülasyonu
                await page.mouse.move(100, 200); 
            }
        }

        console.log("[SUCCESS] Operasyon başarıyla tamamlandı.");

    } catch (error) {
        console.error(`[ERROR] SNR ENGINE Hatası: ${error.message}`);
        throw error;
    } finally {
        // Tarayıcıyı kapat
        await browser.close();
        console.log("[CLEANUP] Tarayıcı kapatıldı.");
    }
};
