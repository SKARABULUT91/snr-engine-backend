import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

// Yardımcı bekleme fonksiyonu
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * SNR ENGINE - Ana Bot Fonksiyonu
 */
export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const launchOptions = {
        headless: "new",
        // RENDER İÇİN KRİTİK: Kurulan Chrome'un yolunu otomatik bulur
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Render hafıza hatalarını önler (Çok Önemli)
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-web-security',
            '--disable-features=WebRtcHideLocalIpsWithMdns',
        ]
    };

    if (proxyData && proxyData.host) {
        console.log(`[PROXY] Bağlantı Kuruluyor: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    
    try {
        const page = await browser.newPage();

        if (proxyData?.user && proxyData?.pass) {
            await page.authenticate({
                username: proxyData.user,
                password: proxyData.pass
            });
        }

        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`[NAVIGATE] Hedefe gidiliyor: ${targetUrl}`);
        
        // Sayfa yüklenirken daha toleranslı davran (timeout 90 sn)
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        // Sayfa açıldıktan sonra 3-5 saniye "insan gibi" bekle
        await sleep(Math.floor(Math.random() * 2000) + 3000);

        console.log("[SCAN] Reklamlar aranıyor...");
        
        const tweets = await page.$$('article[data-testid="tweet"]');

        for (let i = 0; i < Math.min(tweets.length, 10); i++) {
            const tweet = tweets[i];
            
            const isAd = await tweet.evaluate(el => 
                el.innerText.includes('Promoted') || 
                el.innerText.includes('Sponsorlu') || 
                el.innerText.includes('Reklam')
            );

            if (isAd) {
                console.log(`[AD FOUND] Reklam tespit edildi!`);
                
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));

                // Reklam üzerinde 2-4 saniye arası rastgele dur
                const waitTime = Math.floor(Math.random() * (4000 - 2000 + 1) + 2000);
                console.log(`[WAIT] İnceleme süresi: ${waitTime}ms`);
                
                await sleep(waitTime);
                
                // Minik mouse hareketi
                await page.mouse.move(Math.random() * 100, Math.random() * 100); 
            }

            // Her tweet kontrolünden sonra 1 saniye nefes al (Saniyede 5 bin işlemi durduran yer burası!)
            await sleep(1000);
        }

        console.log("[SUCCESS] Operasyon başarıyla tamamlandı.");

    } catch (error) {
        console.error(`[ERROR] SNR ENGINE Hatası: ${error.message}`);
        // Hatayı yukarı fırlat ki sistem sonsuz döngüye girmeden düzgünce kapansın
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Tarayıcı kapatıldı.");
    }
};
