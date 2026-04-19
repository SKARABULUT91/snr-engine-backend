import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * DOCKER KONTEYNERI İÇİNDEKİ SABİT CHROME YOLUNU DÖNDÜRÜR
 */
const getChromePath = () => {
    // Docker (ghcr.io/puppeteer/puppeteer) içindeki standart Chrome yolu
    const dockerPath = '/usr/bin/google-chrome-stable';
    
    if (fs.existsSync(dockerPath)) {
        console.log(`[SYSTEM] Docker Chrome yolu doğrulandı: ${dockerPath}`);
        return dockerPath;
    }
    
    // Eğer yerelde test ediyorsan veya yol farklıysa Environment Variable'dan oku
    return process.env.PUPPETEER_EXECUTABLE_PATH || null;
};

export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const chromePath = getChromePath();
    
    if (!chromePath) {
        console.error("[FATAL] Chrome binary bulunamadı! Dockerfile ve imajı kontrol edin.");
        throw new Error("Executable Chrome binary not found.");
    }

    const launchOptions = {
        headless: "new", 
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--disable-blink-features=AutomationControlled'
        ]
    };

    if (proxyData?.host) {
        console.log(`[NETWORK] SOCKS5 Aktif: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    console.log("[LAUNCH] SNR ENGINE v2 (Docker Mode) ateşleniyor...");
    const browser = await puppeteer.launch(launchOptions);
    
    try {
        const page = await browser.newPage();

        if (proxyData?.user && proxyData?.pass) {
            await page.authenticate({ username: proxyData.user, password: proxyData.pass });
        }

        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        await page.setViewport({ width: 1366, height: 768 });

        console.log(`[NAVIGATION] Hedef: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        // İnsansı bekleme
        await sleep(Math.floor(Math.random() * 3000) + 5000);

        const tweets = await page.$$('article[data-testid="tweet"]');
        console.log(`[SCAN] Radarda ${tweets.length} tweet var.`);

        if (tweets.length > 0) {
            const count = Math.min(tweets.length, 3);
            for (let i = 0; i < count; i++) {
                const tweet = tweets[i];
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                await sleep(2000);

                const isAd = await tweet.evaluate(el => 
                    el.innerText.includes('Promoted') || el.innerText.includes('Sponsorlu') || el.innerText.includes('Reklam')
                );

                if (isAd) {
                    console.log(`[TARGET] Reklam yakalandı! "Ghost Interaction" uygulanıyor...`);
                    for(let j=0; j<4; j++) {
                        await page.mouse.move(Math.random() * 600 + 100, Math.random() * 600 + 100);
                        await sleep(800);
                    }
                    await sleep(5000);
                }
            }
        }

        console.log("[SUCCESS] Operasyon başarıyla tamamlandı.");

    } catch (error) {
        console.error(`[CRITICAL] Motor kilitlendi: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Sistem izleri temizlendi.");
    }
};
