import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [classMarkup, classApp, aiMarkup, aiApp] = await Promise.all([
  readFile(new URL('frontend/teacher/classes/detail/index.html', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/app.js', root), 'utf8'),
  readFile(new URL('frontend/teacher/ai-tools/index.html', root), 'utf8'),
  readFile(new URL('frontend/teacher/ai-tools/app.js', root), 'utf8'),
]);

test('class invitation list is filtered by the server class relation', () => {
  assert.match(classApp, /records\.filter\(\(item\) => item\?\.class\?\.id === classId\)/);
  assert.match(classMarkup, /邀请学生加入本班/);
});

test('server status and missing usage values remain explicit', () => {
  for (const status of ['ACTIVE', 'EXPIRED', 'REVOKED', 'EXHAUSTED']) {
    assert.match(classApp, new RegExp(`${status}:`));
  }
  assert.match(classApp, /服务器未返回/);
  assert.match(classApp, /失效凭证已隐藏/);
});

test('copy waits for Clipboard API success and keeps a manual selection path', () => {
  assert.match(classApp, /await navigator\.clipboard\.writeText\(invitation\.code\)/);
  assert.match(classApp, /复制失败。邀请码已选中/);
  assert.match(classApp, /codeInput\.select\(\)/);
});

test('AI tools coworker code has no static code or page-text fallback', () => {
  assert.doesNotMatch(aiMarkup, /TCH-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  assert.match(aiMarkup, /此码不用于学生加入班级/);
  assert.match(aiApp, /const response = await api\.getInviteCode\(\)/);
  assert.match(aiApp, /setCoworkerInviteCode\('', `\$\{error\?\.message/);
  assert.match(aiApp, /await navigator\.clipboard\.writeText\(codeToCopy\)/);
  assert.match(aiApp, /复制失败。邀请码已选中/);
});
