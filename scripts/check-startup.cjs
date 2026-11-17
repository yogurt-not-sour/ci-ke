const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function checkStartup(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [];
  const errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/welcome-meadow-fast.webp', async route => {
    await gate;
    await route.fulfill({ path: path.resolve(__dirname, '../assets/welcome-meadow-fast.webp'), contentType: 'image/webp' });
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.welcome-landscape').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.welcome-landscape').evaluate(img => getComputedStyle(img).opacity), '0');
    assert(!requests.some(address => /fonts\.google|fonts\.gstatic|\/imageGen\.js|\/sceneBMeta\.js/.test(address)));
    await page.getByRole('button', { name: '进入此刻', exact: true }).click();
    assert.equal(await page.locator('.emotion-btn').count(), 6);
    await page.getByRole('button', { name: '返回', exact: true }).click();
    release();
    await page.locator('.welcome-landscape.is-ready').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.welcome-landscape').evaluate(img => getComputedStyle(img).opacity), '1');
    assert.equal(requests.filter(address => address.endsWith('/assets/welcome-meadow-fast.webp')).length, 1);
    await page.screenshot({ path: path.join(output, 'welcome-fast-mobile.png') });
    assert.deepEqual(errors, []);
  } finally { release(); await page.close(); }

  const failed = await browser.newPage();
  try {
    await failed.route('**/assets/welcome-meadow-fast.webp', route => route.abort());
    await failed.goto(url);
    await failed.getByText('风景暂时没能加载，你仍可以进入此刻。', { exact: true }).waitFor();
    assert.equal(await failed.locator('.welcome-landscape').isVisible(), false);
    await failed.getByRole('button', { name: '进入此刻', exact: true }).click();
    assert.equal(await failed.locator('.emotion-btn').count(), 6);
  } finally { await failed.close(); }
  console.log('PASS: delayed image stays hidden until decoded, entry works during download, one preload download, no external fonts/eager AI modules, failed-image fallback.');
};
