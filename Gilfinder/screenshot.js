const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.goto('file:///home/user/Navi-help/gilfinder/demo.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/user/Navi-help/gilfinder/demo-screenshot.png', fullPage: false });
  console.log('Screenshot saved!');
  await browser.close();
})();
