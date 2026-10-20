import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path) => readFile(resolve(process.cwd(), path), 'utf8');

test('teacher studio uses an unscaled fluid canvas and retains desktop columns', async () => {
  const [shellJs, responsiveCss, studioCss] = await Promise.all([
    read('shared/teacher-shell.js'),
    read('teacher/courses/spring/studio/responsive-studio.css'),
    read('teacher/courses/spring/studio/style.css'),
  ]);

  assert.match(shellJs, /designRoot\.style\.transform = 'none'/);
  assert.match(responsiveCss, /transform:\s*none\s*!important/);
  assert.match(responsiveCss, /grid-template-columns:\s*minmax\(220px,\s*\.85fr\)\s+minmax\(360px,\s*1\.8fr\)\s+minmax\(260px,\s*1fr\)/);
  assert.match(responsiveCss, /\.title-copy h1\s*\{[^}]*font-size:\s*clamp\(28px,\s*2\.4vw,\s*43px\)/s);
  assert.match(responsiveCss, /@media\s*\(max-width:\s*960px\)/);
  assert.match(responsiveCss, /\.ts-design-host\.ts-design-host--responsive-studio \.panels\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(studioCss, /grid-template-columns:minmax\(0,1fr\)/);
});

test('studio action targets stay at least 44px and save status remains announced', async () => {
  const [responsiveCss, studioHtml] = await Promise.all([
    read('teacher/courses/spring/studio/responsive-studio.css'),
    read('teacher/courses/spring/studio/index.html'),
  ]);

  assert.match(responsiveCss, /\.title-copy \.edit\s*\{[^}]*min-height:\s*44px/s);
  assert.match(responsiveCss, /button\[data-action="add-unit"\][\s\S]*?min-height:\s*44px/);
  assert.match(responsiveCss, /\.tabs button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(studioHtml, /data-action="save-course"[^>]*aria-keyshortcuts=/);
  assert.match(studioHtml, /data-bind="status-label" aria-live="polite"/);
});
