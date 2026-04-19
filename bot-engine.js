import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * RENDER ÜZERİNDE CHROME YOLUNU BULMA STRATEJİSİ (ZIRHLI MOD)
 */
const getChromePath = () => {
    // 1. STRATEJİ: Kesinleşmiş Manuel Yol (En yüksek öncelik)
    const manualPath = '/opt/render/.cache/puppeteer/chrome/linux-147.0.7727.56/chrome-linux64/chrome';
    if (fs.existsSync(manualPath)) {
        console.log(`[SYSTEM] Chrome manuel yolda bulundu: ${manualPath}`);
        return manualPath;
    }

    // 2. STRATEJİ: Recursive (Özyinelemeli) Derin Tarama
    const rootPath = '/opt/render/.cache/puppeteer/chrome';
    try {
        if (!fs.existsSync(rootPath)) return null;

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

        const detected = findBinary(rootPath);
        if (detected) {
            console.log(`[SYSTEM] Chrome derin tarama ile bulundu: ${detected}`);
            return detected;
        }
    } catch (err) {
        console.error("[SYSTEM] Tarama hatası:", err.message);
    }

    return null;
};

/**
 * SNR ENGINE V2 - ÜST DÜZEY OPERASYON MOTORU
 */
export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const detectedPath = getChromePath();
    
    const launchOptions = {
        headless: "new",
        executablePath: detectedPath, // Otomatik bulunan veya manuel yol
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

    if (proxyData && proxyData.host) {
        console.log(`[NETWORK] Proxy Aktif: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    console.log("[LAUNCH] Tarayıcı başlatılıyor...");
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
        await page.setViewport({ width: 1440, height: 900 });

        console.log(`[NAVIGATION] Hedef: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        console.log("[WAIT] İnsansı analiz...");
        await sleep(Math.floor(Math.random() * 4000) + 4000);

        const tweets = await page.$$('article[data-testid="tweet"]');
        console.log(`[SCAN] ${tweets.length} tweet bulundu.`);

        if (tweets.length > 0) {
            const selectedIndices = Array.from({ length: Math.min(tweets.length, 10) }, (_, i) => i)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            for (const index of selectedIndices) {
                const tweet = tweets[index];
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                await sleep(2500);

                const isAd = await tweet.evaluate(el => 
                    el.innerText.includes('Promoted') || 
                    el.innerText.includes('Sponsorlu') || 
                    el.innerText.includes('Reklam')
                );

                if (isAd) {
                    console.log(`[TARGET] Reklam yakalandı, etkileşim simüle ediliyor...`);
                    for(let j=0; j<4; j++) {
                        await page.mouse.move(Math.random() * 500, Math.random() * 500);
                        await sleep(600);
                    }
                    await sleep(Math.floor(Math.random() * 5000) + 5000);
                }
            }
        }

        console.log("[SUCCESS] Operasyon tamam.");

    } catch (error) {
        console.error(`[CRITICAL] Hata: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Sistem kapatıldı.");
    }
};
