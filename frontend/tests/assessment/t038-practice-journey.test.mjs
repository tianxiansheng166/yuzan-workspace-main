import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const win = {};
const journeySource = readFileSync(new URL('../../assessment/assets/practice-journey.js', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('../../assessment/assets/practice.js', import.meta.url), 'utf8');
vm.runInNewContext(journeySource, { window: win });
const { render } = win.YuzanPracticeJourney;

test('oral practice is a small real server-filter tool, not three promotional navigation cards', () => {
  const html = render({ tab: 'RECOMMENDED' });
  assert.match(html, /data-journey-oral/);
  assert.match(html, /按当前学校已开放的真实录音要求筛选/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.doesNotMatch(html, /practice-journey-lane|data-tab="MOCK"|data-tab="SPECIALIZED"/);
  assert.doesNotMatch(html, /正式成绩 \d+ 分|官方考试|AI评分/);
  assert.match(catalogSource, /\['MOCK', '模拟练习'\]/);
  assert.match(catalogSource, /\['SPECIALIZED', '专项训练'\]/);
});

test('recording filter active state is accessible and keeps catalog request controls', () => {
  const inactive = render({ tab: 'MOCK', filters: { requiresRecording: 'true' } });
  const active = render({ tab: 'ALL', filters: { requiresRecording: 'true' } });
  assert.match(inactive, /aria-pressed="false"/);
  assert.match(active, /aria-pressed="true"/);
  assert.match(active, /正在筛选录音练习/);
  assert.match(catalogSource, /state\.filters = \{ requiresRecording: 'true' \}/);
  assert.match(catalogSource, /querySelector\('\.catalog-head-tools'\)\?\.insertAdjacentHTML\('afterbegin'/);
  assert.doesNotMatch(catalogSource, /querySelector\('\.catalog-tabs'\)\?\.insertAdjacentHTML\('beforebegin'/);
});
