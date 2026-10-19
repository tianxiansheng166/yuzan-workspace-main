import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../../assessment/assets/practice.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../assessment/assets/practice.css', import.meta.url), 'utf8');

test('mobile ability controls remain available in keyboard-operable native disclosure', () => {
  assert.match(app, /document\.createElement\('details'\)/);
  assert.match(app, /document\.createElement\('summary'\)/);
  assert.match(app, /mobileAbilities\.className = 'catalog-mobile-abilities'/);
  assert.match(app, /desktopAbilities\.querySelector\('\.ability-rail'\)\?\.cloneNode\(true\)/);
  assert.match(app, /selectedCategory \? `能力方向：\$\{selectedCategory\}`/);
  assert.match(css, /\.practice-page \.catalog-mobile-abilities summary:focus-visible/);
});

test('catalog filters and real server-owned practice tab requests remain intact', () => {
  assert.match(app, /data-tab="\$\{value\}"/);
  assert.match(app, /data-filter-key="abilityCategory"/);
  assert.match(app, /requiresRecording: 'true'/);
  assert.match(app, /key === 'requiresRecording' \? \(value === 'true' \? '需要录音' : '无需录音'\)/);
  assert.match(app, /catalogType: \['SPECIALIZED', 'COMPREHENSIVE', 'MOCK'\]/);
  assert.match(css, /\.practice-page \.catalog-ability\{display:none\}/);
  assert.match(css, /\.practice-page \.catalog-mobile-abilities\{position:relative/);
});

test('mobile search keeps its action beside the field with a comfortable touch target', () => {
  assert.match(css, /\.practice-page \.catalog-search\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(css, /\.practice-page \.catalog-search \.btn\{min-height:44px/);
});

test('mobile first-card hierarchy reflows the tools and preserves a strong cover', () => {
  assert.match(css, /\.practice-page \.catalog-head-tools\{display:flex;flex-wrap:wrap/);
  assert.match(css, /\.practice-page \.practice-cover\{height:120px\}/);
  assert.match(css, /\.practice-page \.practice-tile h2\{font-size:18px;line-height:1\.2\}/);
  assert.match(css, /\.practice-page \.catalog-oral-help\{display:none\}/);
});
