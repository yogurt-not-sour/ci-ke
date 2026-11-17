const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function checkDetails(browser, url, output) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const prompts = [];
  const metadata = [];
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('**/api/scene-image', route => {
    prompts.push(route.request().postDataJSON().prompt);
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/scene-b-meta', route => {
    metadata.push(route.request().postDataJSON());
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  async function questions() {
    await page.goto(url);
    await page.getByRole('button', { name: '进入此刻', exact: true }).click();
    await page.getByRole('button', { name: '我很焦虑', exact: true }).click();
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.getByRole('button', { name: '2 肩膀紧、胃不舒服、身体绷着', exact: true }).click();
    await page.getByRole('button', { name: '我完成了', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.locator('#trigger-event').fill('明天要在会议上汇报');
    await page.getByRole('button', { name: '再补充一点画面', exact: true }).click();
  }
  try {
    await questions();
    assert(await page.getByText('那次汇报或交流，会在怎样的房间里？', { exact: true }).isVisible());
    assert.equal(await page.locator('.voice-input').count(), 3);
    await page.locator('#scene-setting').fill('有落地窗的会议室');
    await page.locator('#scene-people').fill('我坐在长桌尽头，同事看着屏幕');
    await page.locator('#scene-visuals').fill('傍晚，桌上摊着蓝色笔记本');
    await page.getByRole('button', { name: '返回', exact: true }).click();
    assert.equal(await page.locator('#trigger-event').inputValue(), '明天要在会议上汇报');
    await page.getByRole('button', { name: '再补充一点画面', exact: true }).click();
    assert.equal(await page.locator('#scene-setting').inputValue(), '有落地窗的会议室');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, 'scene-details-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: '生成此刻卡片', exact: true }).click();
    await page.getByRole('button', { name: '看看另一个角度', exact: true }).waitFor();
    assert.equal(prompts.length, 2);
    for (const prompt of prompts) {
      assert(prompt.includes('落地窗'));
      assert(prompt.includes('长桌尽头'));
      assert(prompt.includes('蓝色笔记本'));
      assert(prompt.length < 4000);
    }
    assert(metadata[0].sceneDetails.includes('落地窗'));
    await page.getByRole('button', { name: '保存这些卡片', exact: true }).click();
    const details = await page.evaluate(() => JSON.parse(localStorage.getItem('cike_moment_records'))[0].sceneDetails);
    assert.equal(details.setting, '有落地窗的会议室');
    await questions();
    await page.locator('#scene-setting').fill('跳过后不应保留的房间');
    await page.getByRole('button', { name: '先不补充，直接生成', exact: true }).click();
    await page.getByRole('button', { name: '看看另一个角度', exact: true }).waitFor();
    assert(!prompts.slice(2).some(prompt => prompt.includes('跳过后不应保留')));
    await questions();
    await page.locator('#scene-people').fill('我想伤害自己');
    assert(await page.getByRole('heading', { name: '现在，先保证你的安全' }).isVisible());
    console.log('PASS: contextual scene questions, voice controls, back/draft retention, A/B prompts, metadata payload, saved details, skip and crisis detection. No paid AI calls.');
  } finally { await page.close(); }
};
