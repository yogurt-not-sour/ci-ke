const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.local-qa');
fs.mkdirSync(output, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    const url = `http://127.0.0.1:${server.address().port}/`;
    for (const [name, width, height] of [['mobile', 390, 844], ['small', 320, 568], ['desktop', 1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await page.locator('.welcome-landscape').evaluate(img => img.decode());
      assert.equal(await page.locator('#app-header').isVisible(), false);
      const entry = await page.getByRole('button', { name: '进入此刻' }).boundingBox();
      assert(entry && entry.y >= 0 && entry.y + entry.height <= height, `${name}: entry must fit`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `welcome-${name}.png`) });
      await page.getByRole('button', { name: '进入此刻' }).click();
      assert.equal(await page.locator('.emotion-btn').count(), 6);
      await page.getByRole('button', { name: '返回', exact: true }).click();
      assert(await page.locator('.welcome-page').isVisible());
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '进入此刻' }).click();
    await page.screenshot({ path: path.join(output, 'emotions-mobile.png') });
    const backgrounds = new Set();
    for (const [id, label] of [['anxiety', '我很焦虑'], ['sad', '我很难过'], ['angry', '我很生气'], ['hyper', '我很亢奋'], ['wronged', '我很委屈'], ['unclear', '我说不清']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-emotion'), id);
      backgrounds.add(await page.locator('.app-frame').evaluate(el => getComputedStyle(el).backgroundColor));
      await page.screenshot({ path: path.join(output, `theme-${id}.png`) });
      await page.getByRole('button', { name: '返回', exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-emotion'), 'neutral');
    }
    assert.equal(backgrounds.size, 6);
    await page.getByRole('button', { name: '我很焦虑', exact: true }).click();
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.getByRole('button', { name: '2 肩膀紧、胃不舒服、身体绷着', exact: true }).click();
    await page.getByRole('button', { name: '我完成了', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    assert.equal(await page.locator('textarea').count(), 3);
    assert.equal(await page.locator('html').getAttribute('data-emotion'), 'anxiety');
    await page.reload();
    assert(await page.locator('.welcome-page').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: 3 viewports; welcome/back/reload; 6 themes; anxiety flow; no page errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
