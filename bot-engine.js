import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Stealth eklentisini aktif et
puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const startBot = async (targetUrl, proxyData) => {
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ];

    const launchOptions = {
        headless: "new",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
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
        await page.setViewport({ width: 1440, height: 900 }); // Daha doğal bir çözünürlük

        console.log(`[NAVIGATION] Hedef profile sızılıyor: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        // İlk yükleme sonrası doğal bekleme
        console.log("[WAIT] Sayfa analizi yapılıyor (3-7 sn)...");
        await sleep(Math.floor(Math.random() * 4000) + 3000);

        // Tweetleri tara
        const tweets = await page.$$('article[data-testid="tweet"]');
        console.log(`[SCAN] ${tweets.length} adet tweet radara girdi.`);

        if (tweets.length > 0) {
            // İLK 10 TWEET arasından RASTGELE 3 TANE SEÇ (Operasyonun kalbi burası)
            const allIndices = Array.from({ length: Math.min(tweets.length, 10) }, (_, i) => i);
            const selectedIndices = allIndices.sort(() => 0.5 - Math.random()).slice(0, 3);
            
            console.log(`[DECISION] Analiz için seçilen tweetler: ${selectedIndices.map(n => n + 1).join(', ')}`);

            for (const index of selectedIndices) {
                const tweet = tweets[index];
                
                console.log(`[ACTION] ${index + 1}. tweet inceleniyor...`);
                
                // Yumuşak kaydırma (Scroll)
                await tweet.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                await sleep(2000);

                // Reklam kontrolü
                const isAd = await tweet.evaluate(el => 
                    el.innerText.includes('Promoted') || 
                    el.innerText.includes('Sponsorlu') || 
                    el.innerText.includes('Reklam')
                );

                if (isAd) {
                    console.log(`[TARGET FOUND] Reklam tespit edildi! Odaklanılıyor...`);
                    
                    // Mouse simülasyonu: Tweet üzerinde rastgele gezinme
                    for(let j=0; j<3; j++) {
                        await page.mouse.move(Math.random() * 500 + 100, Math.random() * 500 + 100);
                        await sleep(500);
                    }
                    
                    const inspectTime = Math.floor(Math.random() * 5000) + 5000;
                    console.log(`[INTERACT] Reklam üzerinde ${inspectTime/1000}s beklendi.`);
                    await sleep(inspectTime);
                } else {
                    console.log(`[PASS] Tweet normal içerik, doğal akışa devam ediliyor.`);
                    await sleep(2000);
                }
            }
        }

        console.log("[SUCCESS] Bu döngüdeki tüm hedefler tamamlandı.");

    } catch (error) {
        console.error(`[CRITICAL] Bot motoru hata verdi: ${error.message}`);
        throw error; 
    } finally {
        await browser.close();
        console.log("[CLEANUP] Kimlik imha edildi, tarayıcı kapatıldı.");
    }
};
