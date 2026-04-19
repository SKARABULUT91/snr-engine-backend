import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

try {
  console.log('--- [TUNNEL MODE] CHROME ENJEKSIYONU BASLATILDI ---');
  
  // Puppeteer'ın kendi yükleme scriptinin yolunu buluyoruz
  const installScript = path.join(process.cwd(), 'node_modules', 'puppeteer', 'install.js');
  
  if (fs.existsSync(installScript)) {
    console.log('[INFO] Yükleme scripti bulundu, Node ile tetikleniyor...');
    
    execSync(`node ${installScript}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer',
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'false'
      }
    });
    
    console.log('--- [SUCCESS] CHROME BINARY YÜKLENDİ ---');
  } else {
    // Alternatif yol (bazı sürümlerde mjs olarak geçer)
    console.log('[INFO] install.js bulunamadı, mjs deneniyor...');
    execSync('node node_modules/puppeteer/install.mjs', { stdio: 'inherit' });
  }

} catch (error) {
  console.error('--- [FATAL ERROR] TUNNEL MODU BASARISIZ ---');
  console.error(error.message);
  process.exit(1);
}
