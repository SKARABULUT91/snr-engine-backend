const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Bu satır Puppeteer'a kurulumu nereye yapacağını ve 
  // NEREDEN okuyacağını zorla söyler.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
