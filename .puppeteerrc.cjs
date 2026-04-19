const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Chrome'u kesinlikle Render'ın izin verdiği bu klasöre kurmaya zorla
  cacheDirectory: join('/opt/render', '.cache', 'puppeteer'),
};
