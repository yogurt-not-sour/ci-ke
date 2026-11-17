const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function checkImages(browser, url) {
  const page = await browser.newPage();
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  try {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(url);
    async function generate() {
      return page.evaluate(async () => {
        const m = await import('/js/imageGen.js');
        return m.generateSceneImageA({ anxietyScore: 5, triggerEvent: '一次汇报' });
      });
    }
    await page.route('**/api/scene-image', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '未配置 ARK_API_KEY' }) }));
    let result = await generate();
    assert.equal(result.source, 'canvas');
    assert(result.fallbackReason.includes('密钥'));
    assert(result.url.startsWith('data:image/'));
    await page.unroute('**/api/scene-image');
    await page.route('**/api/scene-image', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not Found</h1>' }));
    result = await generate();
    assert.equal(result.source, 'canvas');
    assert(result.fallbackReason.includes('后端'));
    await page.unroute('**/api/scene-image');
    await page.route('**/api/scene-image', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: pixel }) }));
    result = await generate();
    assert.equal(result.source, 'ai');
    await page.evaluate(async () => {
      const { IMAGE_CONFIG } = await import('/js/config.js');
      IMAGE_CONFIG.apiBaseUrl = 'https://backend.test';
    });
    result = await generate();
    assert.equal(result.source, 'ai');
    await page.evaluate(async () => {
      const { IMAGE_CONFIG, getApiEndpoint } = await import('/js/config.js');
      if (getApiEndpoint('/api/scene-b-meta') !== 'https://backend.test/api/scene-b-meta') throw new Error('Meta must use configured backend');
      IMAGE_CONFIG.apiBaseUrl = '';
    });

    const root = path.resolve(__dirname, '..');
    let apiRequests = 0;
    await page.route('https://test.github.io/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.includes('/api/')) { apiRequests++; return route.abort(); }
      const file = path.join(root, pathname.replace(/^\/ci-ke\//, '') || 'index.html');
      const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
      return route.fulfill({ contentType, body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    await page.goto('https://test.github.io/ci-ke/index.html');
    result = await page.evaluate(async () => {
      const m = await import('./js/imageGen.js');
      const a = await m.generateSceneImageA({ anxietyScore: 3 });
      const b = await m.generateSceneImageB({ anxietyScore: 3 });
      return { a, b, usingAI: m.isUsingAI() };
    });
    assert.equal(result.a.source, 'canvas');
    assert.equal(result.b.source, 'canvas');
    assert.equal(result.usingAI, false);
    assert(result.a.fallbackReason.includes('尚未连接'));
    assert.equal(apiRequests, 0);
    console.log('PASS: missing key, HTML 404, valid image, external backend routes and GitHub Pages fallback without dead API calls.');
  } finally { await page.close(); }
};
