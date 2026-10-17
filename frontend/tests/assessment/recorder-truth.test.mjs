import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../assets/recorder.js', import.meta.url), 'utf8');
function prototype(navigator = {}) {
  const window = { addEventListener() {} };
  vm.runInNewContext(source, { window, navigator, clearInterval() {}, console });
  return window.YuzanVoiceRecorder.prototype;
}
function recorder(methods) {
  return { reset: async () => {}, setState(state) { this.state = state; },
    stopTracks() { this.tracksStopped = true; }, notify(message) { this.message = message; }, ...methods };
}
test('unsupported local recorder fails visibly without generating demonstration audio', async () => {
  const value = recorder();
  await prototype().start.call(value);
  assert.equal(value.state, 'error');
  assert.equal(value.tracksStopped, true);
  assert.equal(value.blob, undefined);
  assert.match(value.message, /无法录音/);
});
test('microphone denial does not start a simulated recording', async () => {
  const error = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  const value = recorder();
  // Presence of MediaRecorder is checked before requesting the microphone.
  const window = { addEventListener() {}, MediaRecorder: class {} };
  const context = { window, navigator: { mediaDevices: { getUserMedia: async () => { throw error; } } }, clearInterval() {}, console };
  vm.runInNewContext(source, context);
  await window.YuzanVoiceRecorder.prototype.start.call(value);
  assert.equal(value.state, 'error');
  assert.equal(value.simulated, undefined);
  assert.match(value.message, /权限被拒绝/);
});
test('online connectivity alone never marks local audio synchronized', () => {
  let sync;
  prototype({ onLine: true }).scheduleSync.call({ setSync(value) { sync = value; } });
  assert.equal(sync, 'local');
});
