import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * RENDER ÜZERİNDE CHROME YOLUNU TESPİT EDER
 * .puppeteerrc.cjs dosyasındaki cacheDirectory ile uyumlu çalışır.
 */
const getChromePath = () => {
    // Render üzerindeki kesin cache dizini
    const cachePath = '/opt/render/.cache/puppeteer/chrome';
    
    try {
        if (!fs.existsSync(cachePath)) {
            console.log("[SYSTEM] Puppeteer cache dizini bulunamadı.");
            return null;
        }

        // Klasörleri tara ve 'chrome' binary dosyasını bul
        const findBinary = (dir) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    const found = findBinary(fullPath);
                    if (found) return found;
                } else if (file === 'chrome' && fullPath.includes('chrome-linux64')) {
                    return fullPath;
                }
            }
            return null;
        };

        const detected = findBinary(cachePath);
        if (detected) {
            console.log(`[SYSTEM] Chrome başarıyla tetiklendi: ${detected}`);
            return detected;
        }
    } catch (err) {
        console.error("[SYSTEM] Yol tarama hatası:", err.message);
    }
    return null;
};

export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const chromePath = getChromePath();
    
    const launchOptions = {
        headless: "new",
        executablePath: chromePath, // Tespit edilen yol
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
        ]
    };

    if (proxyData?.host) {
        console.log(`[NETWORK] SOCKS5 Aktif: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    console.log("[LAUNCH] SNR ENGINE v2 başlatılıyor...");
    const browser = await puppeteer.launch(launchOptions);
    
    try {
        const page = await browser.newPage();

        if (proxyData?.user && proxyData?.pass) {
            await page.authenticate({ username: proxyData.user, password: proxyData.pass });
        }

        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);
        await page.setViewport({ width: 1440, height: 900 });

        console.log(`[NAVIGATION] Hedef: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        await sleep(Math.floor(Math.random() * 3000) + 3000);

        const tweets = await page.$$('article[data-testid="tweet"]');
        console.log(`[SCAN] ${tweets.length} tweet radarda.`);

        if (tweets.length > 0) {
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
                    console.log(`[TARGET] Reklam bulundu, etkileşim simüle ediliyor...`);
                    for(let j=0; j<3; j++) {
                        await page.mouse.move(Math.random() * 400, Math.random() * 400);
                        await sleep(500);
                    }
                    await sleep(5000);
                }
            }
        }

        console.log("[SUCCESS] Operasyon tamamlandı.");

    } catch (error) {
        console.error(`[CRITICAL] Hata: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Tarayıcı kapatıldı.");
    }
};
