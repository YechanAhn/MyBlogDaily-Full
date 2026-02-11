const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  // Mobile view - iPhone 14 Pro
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3778', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/user/Navi-help/gilfinder/app-screenshot-home.png' });
  console.log('Home screenshot saved!');

  await browser.close();
})();
