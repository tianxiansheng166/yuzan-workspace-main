import { chromium } from '/home/tian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const output = import.meta.dirname;
const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true });
try {
  for (const [width, height] of [[390, 844], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body data-runner-page="runner"><div id="app"></div><div style="position:fixed;z-index:10000;bottom:3px;left:3px;background:#fff;color:#963b20;border:1px solid #963b20;padding:5px;font:12px sans-serif">VISUAL_FIXTURE_ONLY · YZ-RD-T099 · 无 API/数据库</div></body></html>');
    for (const filename of ['app.css', 'runner.css', 'practice-visuals.css']) {
      await page.addStyleTag({ content: readFileSync(path.join(root, 'frontend/assessment/assets', filename), 'utf8') });
    }
    await page.addStyleTag({ content: readFileSync(path.join(root, 'frontend/shared/student-nav.css'), 'utf8') });
    await page.evaluate(() => {
      window.YuzanApi = { getCoursePracticeContext: () => null };
    });
    await page.addScriptTag({ content: readFileSync(path.join(root, 'frontend/assessment/assets/practice-visuals.js'), 'utf8') });
    const source = readFileSync(path.join(root, 'frontend/assessment/assets/runner.js'), 'utf8').replace('  boot();', `
      state.attempt = { id: 'VISUAL_FIXTURE_ONLY', status: 'IN_PROGRESS' };
      state.items = Array.from({length: 3}, (_, i) => ({id: 'fixture-' + i, itemType: 'WRITTEN', prompt: {stimulus: {type:'TEXT', promptText:'请按自己的情况作答，也可以保留空答后交卷。'}, response: {type:'TEXT'}}}));
      state.currentIndex = 2;
      state.submitConfirm = true;
      render();`);
    await page.addScriptTag({ content: source });
    await page.locator('[role="dialog"]').waitFor();
    assert.match(await page.locator('#runner-confirm-copy').innerText(), /3 道题未作答.*按零分计算/);
    assert.equal(await page.locator('[data-confirm-submit]').isEnabled(), true);
    const box = await page.locator('[data-confirm-submit]').boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
    await page.screenshot({ path: path.join(output, `runner-confirm-${width}x${height}.png`), fullPage: false });
    console.log(JSON.stringify({ mode: 'VISUAL_FIXTURE_ONLY', width, height, confirmation: 'enabled', button: box }));
    await page.close();
  }
} finally {
  await browser.close();
}
