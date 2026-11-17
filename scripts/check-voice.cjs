const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function checkVoice(browser, url, output) {
  async function questions(page) {
    await page.goto(url);
    await page.getByRole('button', { name: '进入此刻', exact: true }).click();
    await page.getByRole('button', { name: '我很焦虑', exact: true }).click();
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.getByRole('button', { name: '2 肩膀紧、胃不舒服、身体绷着', exact: true }).click();
    await page.getByRole('button', { name: '我完成了', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '下一步', exact: true }).click();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.addInitScript(() => {
    window.sessions = [];
    window.SpeechRecognition = class {
      constructor() { window.sessions.push(this); }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.aborted = true; this.onend?.(); }
      say(text, isFinal = true) { const result = [{ transcript: text }]; result.isFinal = isFinal; this.onresult?.({ results: [result] }); }
    };
  });
  try {
    await questions(page);
    assert.equal(await page.locator('.voice-input').count(), 3);
    const first = page.locator('textarea').nth(0);
    await first.fill('原来的文字');
    const mic1 = page.getByRole('button', { name: '刚刚发生的事：语音输入', exact: true });
    await mic1.click();
    await page.evaluate(() => sessions[0].say('明天', false));
    await page.evaluate(() => sessions[0].say('明天要汇报'));
    assert.equal(await first.inputValue(), '原来的文字\n明天要汇报');
    const stale = await page.evaluate(() => { window.stale = sessions[0].onresult; return sessions.length; });
    assert.equal(stale, 1);
    await page.getByRole('button', { name: '最担心的事：语音输入', exact: true }).click();
    assert(await page.evaluate(() => sessions[0].aborted));
    await page.evaluate(() => { const r = [{ transcript: '过期结果' }]; window.stale({ results: [r] }); });
    assert.equal(await first.inputValue(), '原来的文字\n明天要汇报');
    await page.evaluate(() => sessions[1].say('怕搞砸'));
    assert.equal(await page.locator('textarea').nth(1).inputValue(), '怕搞砸');
    await page.getByRole('button', { name: '最担心的事：结束说话', exact: true }).click();
    await mic1.click();
    await page.evaluate(() => sessions[2].onerror({ error: 'not-allowed' }));
    assert(await page.getByText('麦克风未获授权。可在浏览器设置中允许，或使用键盘语音。', { exact: true }).isVisible());
    await mic1.click();
    await first.fill('手工编辑');
    assert(await page.evaluate(() => sessions[3].aborted));
    await mic1.click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    assert(await page.evaluate(() => sessions[4].aborted));
    await questions(page);
    await mic1.click();
    await page.evaluate(() => sessions[0].say('我想伤害自己'));
    assert(await page.getByRole('heading', { name: '现在，先保证你的安全' }).isVisible());
    assert(await page.evaluate(() => sessions[0].aborted));
    assert.deepEqual(errors, []);
  } finally { await page.close(); }

  const fallback = await browser.newPage({ viewport: { width: 320, height: 568 } });
  try {
    await fallback.route('https://fonts.googleapis.com/**', route => route.abort());
    await fallback.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
    await questions(fallback);
    await fallback.getByRole('button', { name: '刚刚发生的事：键盘语音输入', exact: true }).click();
    assert(await fallback.locator('textarea').nth(0).evaluate(input => document.activeElement === input));
    assert(await fallback.getByText('请点手机键盘上的麦克风，再说出你的回答；电脑上可使用系统听写。', { exact: true }).isVisible());
    assert(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await fallback.screenshot({ path: path.join(output, 'voice-fallback-mobile.png'), fullPage: true });
  } finally { await fallback.close(); }
  console.log('PASS: speech mock results, interim replacement, field switch, late callbacks, permission error, manual edit, navigation cleanup, crisis trigger and unsupported-browser fallback. Real microphone/WeChat recognition not verified.');
};
