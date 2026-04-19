import { execSync } from 'child_process';

try {
  console.log('--- SNR ENGINE: CHROME ZORLAMALI KURULUM ---');
  // .puppeteerrc.cjs dosyasını okuyup belirttiğimiz yere kuracaktır
  execSync('node node_modules/puppeteer/install.mjs', { 
    stdio: 'inherit',
    env: { ...process.env, PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer' }
  });
  console.log('--- KURULUM TAMAMLANDI ---');
} catch (error) {
  console.error('Zorlamalı kurulum başarısız:', error.message);
  process.exit(1);
}
