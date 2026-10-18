import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const sourceUrl = new URL('../../teacher/reviews/detail.js', import.meta.url);

async function loadValidator() {
  let source = await readFile(sourceUrl, 'utf8');
  const end = /\n  load\(\);\n\}\)\(\);\s*$/;
  assert.match(source, end, 'review page retains its isolated IIFE entry point');
  source = source.replace(end, '\n  globalThis.__teacherReviewTest = { validateScore };\n})();\n');
  const sandbox = {
    document: { querySelector: () => ({}) },
    location: { pathname: '/teacher/reviews/test-item', search: '' },
    window: {},
    URLSearchParams,
  };
  vm.runInNewContext(source, sandbox, { filename: 'teacher-review-detail.js' });
  return sandbox.__teacherReviewTest.validateScore;
}

test('empty and whitespace review scores are rejected before numeric conversion', async () => {
  const validateScore = await loadValidator();
  for (const raw of ['', ' ', '\t  \n']) {
    const result = validateScore(raw, 14);
    assert.equal(result.score, undefined);
    assert.match(result.error, /主动输入 0/);
  }
});

test('an explicitly entered zero is valid and remains numeric zero', async () => {
  const validateScore = await loadValidator();
  const result = validateScore('0', 14);
  assert.equal(result.error, undefined);
  assert.equal(result.score, 0);
});

test('valid positive scores and equivalent trailing zero precision are accepted', async () => {
  const validateScore = await loadValidator();
  assert.equal(validateScore('8.5', 14).score, 8.5);
  assert.equal(validateScore('8.500', 14).score, 8.5);
});

test('invalid, negative, over-maximum, and over-precision scores are rejected', async () => {
  const validateScore = await loadValidator();
  assert.match(validateScore('not-a-score', 14).error, /有效数字/);
  assert.match(validateScore('-0', 14).error, /不能低于 0/);
  assert.match(validateScore('-1', 14).error, /不能低于 0/);
  assert.match(validateScore('14.1', 14).error, /不能超过/);
  assert.match(validateScore('1.23', 14).error, /最多保留一位小数/);
  assert.match(validateScore('1', null).error, /满分信息无效/);
});
