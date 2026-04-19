const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Puppeteer'a Chrome'u tam olarak nereye kuracağını ve 
  // çalışma anında nereden okuyacağını dikte eder.
  // Bu yöntemle Render üzerindeki "Permission Denied" hataları baypas edilir.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
