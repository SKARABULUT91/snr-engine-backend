import { execSync } from 'child_process';

try {
  console.log('--- SNR ENGINE: CHROME KURULUMU BAŞLIYOR ---');
  // Puppeteer'ın kendi kurulum scriptini tetikler
  execSync('node node_modules/puppeteer/install.mjs', { stdio: 'inherit' });
  console.log('--- KURULUM BAŞARILI ---');
} catch (error) {
  console.error('Kurulum hatası:', error.message);
  process.exit(1);
}
