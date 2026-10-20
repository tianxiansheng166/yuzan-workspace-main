import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const playerSource = await readFile(new URL('../../student/learn/spring-2/player.js', import.meta.url), 'utf8');
const pageStyles = await readFile(new URL('../../student/learn/spring-2/style.css', import.meta.url), 'utf8');

test('speech activity marks only its page for the reserved navigation layout', () => {
  assert.match(playerSource, /classList\.toggle\('student-speech-activity', activity\.type === 'SPEECH'\)/);
  assert.match(pageStyles, /body\.student-speech-activity\s+#yuzan-global-nav\s*\{[^}]*position:\s*absolute/s);
  assert.match(pageStyles, /top:\s*max\(12px,\s*env\(safe-area-inset-top\)\)/);
  assert.match(pageStyles, /right:\s*max\(14px,\s*env\(safe-area-inset-right\)\)/);
});

test('speech recorder lives inside the responsive target container', () => {
  assert.match(playerSource, /prompt\.append\(recorder, recordingControls, help\);\s*target\.appendChild\(prompt\)/);
  assert.match(pageStyles, /\.speech-target \.voice-recorder\s*\{[^}]*height:\s*250px/s);
  assert.match(pageStyles, /\.speech-target \.vr-pipeline span\s*\{[^}]*flex:\s*1 1 0/s);
  assert.match(pageStyles, /@media\s*\(max-width:\s*600px\)/);
  assert.match(pageStyles, /\.speech-target \.voice-recorder\s*\{[^}]*height:\s*340px/s);
});

test('speech navigation and recording controls keep touch and keyboard affordances', () => {
  assert.match(pageStyles, /body\.student-speech-activity\s+#yuzan-global-nav \.nav-panel a\s*\{[^}]*min-height:\s*44px/s);
  assert.match(pageStyles, /body\.student-speech-activity\s+#courseRecorder button:focus-visible/);
  assert.match(pageStyles, /padding-bottom:\s*calc\(36px \+ env\(safe-area-inset-bottom\)\)/);
});
