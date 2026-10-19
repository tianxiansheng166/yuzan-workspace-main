import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const win = {};
vm.runInNewContext(readFileSync(new URL('../../assessment/assets/practice-journey.js', import.meta.url), 'utf8'), { window: win });
const { lanes, render } = win.YuzanPracticeJourney;

test('catalog channels use real existing server-side filters, not invented exams', () => {
  const model = lanes({ items: [], tab: 'MOCK' });
  assert.equal(model[0].href, '');
  assert.equal(model[0].filter.value, 'true');
  assert.equal(model[1].tab, 'MOCK');
  assert.equal(model[1].selected, true);
  assert.equal(model[2].tab, 'SPECIALIZED');
  const html = render({ items: [], tab: 'RECOMMENDED' });
  assert.match(html, /data-filter-key="requiresRecording"/);
  assert.match(html, /data-tab="MOCK"/);
  assert.match(html, /data-tab="SPECIALIZED"/);
  assert.match(html, /不是官方考试/);
  assert.doesNotMatch(html, /正式成绩 \d+ 分|官方认证/);
});

test('only an eligible recording item offers a direct authorized practice link', () => {
  const model = lanes({ items: [
    { id: 'written', title: '短文', requiresRecording: false },
    { id: 'oral&a', title: '<朗读>', requiresRecording: true },
  ] });
  assert.equal(model[0].href, '/student/practices/oral%26a/');
  const html = render({ items: [{ id: 'oral&a', title: '<朗读>', requiresRecording: true }] });
  assert.match(html, /oral%26a/);
  assert.match(html, /&lt;朗读&gt;/);
  assert.doesNotMatch(html, /<朗读>/);
});
