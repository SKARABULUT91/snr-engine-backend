import { execSync } from 'child_process';

try {
  console.log('--- [FORCE] CHROME INDIRME OPERASYONU BASLATILDI ---');
  
  // Puppeteer'ın kendi CLI aracını kullanarak kurulumu zorluyoruz
  // Bu komut, ortam değişkenlerini (SKIP_DOWNLOAD vb.) baypas eder.
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer',
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'false'
    }
  });

  console.log('--- [SUCCESS] CHROME BINARY SISTEME ENJEKTE EDILDI ---');
} catch (error) {
  console.error('--- [ERROR] KURULUM BASARISIZ ---');
  console.error(error.message);
  process.exit(1);
}
