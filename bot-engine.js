import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * RENDER & LINUX ÜZERİNDE CHROME BINARY DOSYASINI BULUR
 * Hem sistem dizinini hem de yerel cache dizinini tarar.
 */
const getChromePath = () => {
    // Taranacak olası kök dizinler
    const possiblePaths = [
        '/opt/render/.cache/puppeteer/chrome', // Render Sistem Dizini
        path.join(process.cwd(), '.cache', 'puppeteer', 'chrome'), // Yerel Proje Dizini
        path.join(process.cwd(), 'node_modules', 'puppeteer', '.local-chromium') // Eski sürümler için
    ];
    
    try {
        const findBinary = (dir) => {
            if (!fs.existsSync(dir)) return null;
            
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    const found = findBinary(fullPath);
                    if (found) return found;
                } else if (file === 'chrome' && (fullPath.includes('chrome-linux64') || fullPath.includes('linux'))) {
                    return fullPath;
                }
            }
            return null;
        };

        for (const root of possiblePaths) {
            const detected = findBinary(root);
            if (detected) {
                console.log(`[SYSTEM] Chrome lokasyonu doğrulandı: ${detected}`);
                return detected;
            }
        }
    } catch (err) {
        console.error("[SYSTEM] Yol tarama hatası:", err.message);
    }
    return null;
};

export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const chromePath = getChromePath();
    
    const launchOptions = {
        // Render gibi ortamlarda 'new' headless modu en stabil olanıdır
        headless: "new", 
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Kaynak tüketimini minimize eder
            '--disable-extensions'
        ]
    };

    if (proxyData?.host) {
        console.log(`[NETWORK] SOCKS5 Bağlantısı Kuruluyor: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    console.log("[LAUNCH] SNR ENGINE v2 ateşleniyor...");
    const browser = await puppeteer.launch(launchOptions);
    
    try {
        const page = await browser.newPage();

        // Proxy kimlik doğrulaması (Varsa)
        if (proxyData?.user && proxyData?.pass) {
            await page.authenticate({ username: proxyData.user, password: proxyData.pass });
        }

        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        await page.setViewport({ width: 1366, height: 768 });

        console.log(`[NAVIGATION] Hedefe sızılıyor: ${targetUrl}`);
        // Twitter/X için timeout süresini uzun tutmak hayat kurtarır
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        await sleep(5000);

        const tweets = await page.$$('article[data-testid="tweet"]');
        console.log(`[SCAN] Görüş alanında ${tweets.length} tweet tespit edildi.`);

        if (tweets.length > 0) {
            // Rastgele 2 tweet seç
            const selectedIndices = Array.from({ length: Math.min(tweets.length, 10) }, (_, i) => i)
                .sort(() => 0.5 - Math.random())
                .slice(0, 2);

            for (const index of selectedIndices) {
                const tweet = tweets[index];
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                await sleep(2000);

                const isAd = await tweet.evaluate(el => 
                    el.innerText.includes('Promoted') || el.innerText.includes('Sponsorlu') || el.innerText.includes('Reklam')
                );

                if (isAd) {
                    console.log(`[TARGET] Reklam yakalandı! "Ghost Interaction" başlatılıyor...`);
                    // İnsansı mouse hareketleri
                    for(let j=0; j<4; j++) {
                        await page.mouse.move(Math.random() * 500 + 100, Math.random() * 500 + 100);
                        await sleep(700);
                    }
                    await sleep(6000);
                }
            }
        }

        console.log("[SUCCESS] Hayalet operasyon başarıyla tamamlandı.");

    } catch (error) {
        console.error(`[CRITICAL] Operasyon sırasında motor kilitlendi: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Tarayıcı kapatıldı, sistem izleri silindi.");
    }
};
