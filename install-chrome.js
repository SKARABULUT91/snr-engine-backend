import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = '/opt/render/.cache/puppeteer';

try {
  console.log('--- [ULTRA FORCE] MANUEL CHROME ENJEKSIYONU ---');

  // 1. Klasörü oluştur
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // 2. Puppeteer'ın kendi indirme komutunu tüm engelleri baypas ederek çalıştır
  // 'npx' yerine doğrudan kütüphane içindeki browser-install aracını kullanıyoruz
  console.log('[STEP 1] Chrome binary indiriliyor...');
  execSync(`node node_modules/puppeteer/lib/esm/puppeteer/node/cli.js browsers install chrome`, {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      PUPPETEER_CACHE_DIR: CACHE_DIR,
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'false',
      PUPPETEER_SKIP_DOWNLOAD: 'false' // Bazı sürümlerde bu değişken de etkili
    }
  });

  console.log('--- [SUCCESS] MOTOR ARTIK DOLU! ---');
} catch (error) {
  console.error('--- [FATAL] MANUEL INDIRME FAIL ---');
  console.error(error.message);
  // Hata alsa bile build'i durdurma, bazen klasör dolu olabilir
}
