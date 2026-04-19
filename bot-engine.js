import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * RENDER ÜZERİNDE CHROME YOLUNU OTOMATİK TESPİT EDER
 */
const getChromePath = () => {
    const rootPath = '/opt/render/.cache/puppeteer/chrome';
    
    try {
        if (!fs.existsSync(rootPath)) {
            console.log("[SYSTEM] Puppeteer cache dizini bulunamadı.");
            return null;
        }

        const versions = fs.readdirSync(rootPath);
        for (const v of versions) {
            const fullPath = path.join(rootPath, v, 'chrome-linux64/chrome');
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
    } catch (err) {
        console.error("[SYSTEM] Chrome yolu taranırken hata:", err.message);
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

    // Otomatik yol tespiti devrede
    const detectedPath = getChromePath();
    console.log(`[LAUNCH] Tespit edilen Chrome: ${detectedPath || 'Varsayılan'}`);

    const launchOptions = {
        headless: "new",
        executablePath: detectedPath,
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
        console.log(`[NETWORK] SOCKS5 Protokolü aktif: ${proxyData.host}`);
        launchOptions.args.push(`--proxy-server=socks5://${proxyData.host}:${proxyData.port}`);
    }

    console.log("[LAUNCH] Motor çalıştırılıyor...");
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

        console.log(`[NAVIGATION] Hedef profile sızılıyor: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        console.log("[WAIT] İnsansı analiz süreci başladı (4-8 sn)...");
        await sleep(Math.floor(Math.random() * 4000) + 4000);

        // Tweetleri tara
        const tweets = await page.$$('article[data-testid="tweet"]');
        console.log(`[SCAN] ${tweets.length} adet tweet radara girdi.`);

        if (tweets.length > 0) {
            const allIndices = Array.from({ length: Math.min(tweets.length, 10) }, (_, i) => i);
            const selectedIndices = allIndices.sort(() => 0.5 - Math.random()).slice(0, 3);
            
            console.log(`[DECISION] Karışık inceleme listesi: ${selectedIndices.map(n => n + 1).join(', ')}`);

            for (const index of selectedIndices) {
                const tweet = tweets[index];
                
                console.log(`[ACTION] ${index + 1}. tweet mercek altına alındı.`);
                
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                await sleep(2500);

                const isAd = await tweet.evaluate(el => 
                    el.innerText.includes('Promoted') || 
                    el.innerText.includes('Sponsorlu') || 
                    el.innerText.includes('Reklam')
                );

                if (isAd) {
                    console.log(`[TARGET FOUND] Reklam tespit edildi! İnceleme derinleştiriliyor...`);
                    
                    for(let j=0; j<4; j++) {
                        const x = Math.random() * 400 + 200;
                        const y = Math.random() * 400 + 200;
                        await page.mouse.move(x, y);
                        console.log(`[MOUSE] Koordinat: ${Math.floor(x)},${Math.floor(y)}`);
                        await sleep(600);
                    }
                    
                    const inspectTime = Math.floor(Math.random() * 6000) + 5000;
                    console.log(`[INTERACT] İnceleme tamamlanıyor (${inspectTime/1000}s)...`);
                    await sleep(inspectTime);
                } else {
                    console.log(`[PASS] Normal içerik görüldü, pas geçiliyor.`);
                    await sleep(2000);
                }
            }
        }

        console.log("[SUCCESS] Döngü başarıyla nihayete erdirildi.");

    } catch (error) {
        console.error(`[CRITICAL ERROR] SNR ENGINE kilitlendi: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Kimlik imha edildi, tarayıcı güvenli şekilde kapatıldı.");
    }
};
