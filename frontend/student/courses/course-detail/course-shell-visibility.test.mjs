import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(
  new URL('./style.css', import.meta.url),
  'utf8',
);

test('course shell hidden states override component display rules', () => {
  assert.match(
    css,
    /\.cp-loading\[hidden\],\s*\.cp-error\[hidden\],\s*\.cp-page\[hidden\]\s*\{\s*display:\s*none;/,
  );
});
