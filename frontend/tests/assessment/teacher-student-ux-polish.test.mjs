import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path) => readFile(resolve(process.cwd(), path), 'utf8');

test('teacher studio uses a readable stacked layout on small screens', async () => {
  const [shellJs, responsiveCss, studioCss, studioHtml] = await Promise.all([
    read('shared/teacher-shell.js'),
    read('teacher/courses/spring/studio/responsive-studio.css'),
    read('teacher/courses/spring/studio/style.css'),
    read('teacher/courses/spring/studio/index.html'),
  ]);

  assert.match(shellJs, /classList\.contains\('responsive-studio'\)/);
  assert.match(shellJs, /ts-design-host--responsive-studio/);
  assert.match(responsiveCss, /\.ts-design-host\.ts-design-host--responsive-studio\s*\{[\s\S]*?height:\s*auto/);
  assert.match(responsiveCss, /main\.design\.responsive-studio\s*\{[\s\S]*?transform:\s*none\s*!important/);
  assert.match(responsiveCss, /@media\s*\(max-width:\s*960px\)/);
  assert.match(responsiveCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(studioCss, /@media\(max-width:760px\)\{[\s\S]*?\.panels\{height:auto;display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(responsiveCss, /\.title-actions button\s*\{[\s\S]*?flex:\s*1 1 calc\(50% - 8px\);\s*min-width:\s*0/);
  assert.match(studioHtml, /data-action="save-course"/);
  assert.match(studioHtml, /role="group" aria-label="课程操作"/);
  assert.match(studioHtml, /保存草稿后，可提交审核或发布课程；发布成功后/);
});
test('teacher studio saves visible edits before review without changing publication routes', async () => {
  const studioJs = await read('teacher/courses/spring/studio/studio.js');
  const saveHandlerStart = studioJs.indexOf("$('[data-action=\"save-course\"]')?.addEventListener");
  const reviewHandlerStart = studioJs.indexOf("document.querySelector('.submit')?.addEventListener");
  const publishHandlerStart = studioJs.indexOf("$('[data-action=\"publish-course-version\"]')?.addEventListener");
  const reviewHandler = studioJs.slice(reviewHandlerStart, studioJs.indexOf('\n  });', reviewHandlerStart));
  const publishHandler = studioJs.slice(publishHandlerStart, studioJs.indexOf('\n  });', publishHandlerStart));

  assert.notEqual(saveHandlerStart, -1, 'visible save action has a handler');
  assert.notEqual(reviewHandlerStart, -1, 'review action remains available');
  assert.notEqual(publishHandlerStart, -1, 'publish action remains available');
  assert.match(reviewHandler, /dirty && !\(await saveCourse\(\)\)/);
  assert.ok(publishHandler.indexOf('dirty && !(await saveCourse())') < publishHandler.indexOf('/publish`'));
  assert.match(studioJs, /\(e\.ctrlKey \|\| e\.metaKey\).*e\.key\.toLowerCase\(\) === 's'/);
});
