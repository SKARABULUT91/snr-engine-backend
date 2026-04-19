import { execSync } from 'child_process';

try {
  console.log('--- SNR ENGINE: CHROME KURULUMU BAŞLIYOR ---');
  // Puppeteer'ın içindeki kurulum scriptini doğrudan node ile çalıştırıyoruz
  execSync('node node_modules/puppeteer/install.mjs', { 
    stdio: 'inherit',
    env: { ...process.env, PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer' }
  });
  console.log('--- KURULUM BAŞARILI ---');
} catch (error) {
  console.error('Kurulum hatası:', error.message);
  process.exit(1);
}
