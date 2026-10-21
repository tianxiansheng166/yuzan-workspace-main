import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const runnerSource = readFileSync(new URL('../../assessment/assets/runner.js', import.meta.url), 'utf8');
const formalSource = readFileSync(new URL('../../assessment/assets/app.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const attempt = { id: 'attempt-fixture', status: 'IN_PROGRESS', enrollmentId: 'enrollment-fixture' };

function answerItem(id, value, responseType = 'TEXT') {
  return {
    id,
    itemType: responseType === 'SPEECH' ? 'SPEECH' : 'WRITTEN',
    prompt: {
      stimulus: { type: 'TEXT', promptText: 'TEST_FIXTURE_ONLY' },
      response: { type: responseType },
    },
    studentAnswer: value === undefined ? null : { content: { value } },
  };
}

function makeDocument() {
  let html = '';
  let elements = new Map();
  const root = {
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; elements = new Map(); },
  };
  const querySelector = selector => {
    if (selector === '#app') return root;
    const attribute = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!attribute && !selector.startsWith('.')) return null;
    if (!html.includes(attribute || selector.slice(1))) return null;
    if (!elements.has(selector)) {
      elements.set(selector, {
        dataset: {}, style: {}, listeners: new Map(), disabled: false, hidden: false,
        value: selector === '[data-text]'
          ? html.match(/<textarea[^>]*data-text[^>]*>(.*?)<\/textarea>/s)?.[1] || ''
          : '',
        addEventListener(name, callback) { this.listeners.set(name, callback); },
        focus() {},
        setAttribute() {},
      });
    }
    return elements.get(selector);
  };
  return {
    root,
    querySelector,
    querySelectorAll: () => [],
    getElementById: () => root,
    body: { dataset: { page: 'submit' } },
  };
}

function mountRunner(overrides = {}) {
  const document = makeDocument();
  const calls = { submit: 0, finalize: [], saves: [], routes: [], alerts: [] };
  const api = {
    getToken: () => 'FIXTURE_TOKEN',
    requireAuth: () => true,
    getCoursePracticeContext: () => null,
    saveWrittenAnswer: async (attemptId, id, payload) => { calls.saves.push({ attemptId, id, payload }); },
    finalizeWrittenAnswer: async (attemptId, id) => { calls.finalize.push({ attemptId, id }); },
    submitAssessmentSession: async () => { calls.submit += 1; return {}; },
    getPracticeAttempt: async () => attempt,
    getPracticeAttemptItems: async () => [],
    ...overrides,
  };
  const location = { pathname: '/student/practices/attempts/attempt-fixture/runner/', search: '', href: '' };
  const window = { YuzanApi: api, addEventListener() {}, setTimeout, clearTimeout };
  const context = {
    window, YuzanApi: api, document, location, URLSearchParams,
    console: { error() {}, log() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: { mediaDevices: null },
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} },
  };
  const source = runnerSource.replace(
    '  boot();',
    '  window.fixture = { state, render, submit, save, flush };',
  );
  vm.runInNewContext(source, context);
  return { ...context.window.fixture, calls, document, location, click: async selector => {
    const element = document.querySelector(selector);
    assert.ok(element, selector);
    const handler = element.listeners.get('click');
    assert.equal(typeof handler, 'function');
    await handler({ target: element, currentTarget: element });
    await tick();
  } };
}

function mountFormal(overrides = {}) {
  const document = makeDocument();
  const calls = { submit: 0, finalize: [], saves: [], alerts: [] };
  const api = {
    getToken: () => 'FIXTURE_TOKEN',
    getCoursePracticeContext: () => null,
    saveWrittenAnswer: async (attemptId, id, payload) => { calls.saves.push({ attemptId, id, payload }); },
    finalizeWrittenAnswer: async (attemptId, id) => { calls.finalize.push({ attemptId, id }); },
    submitAssessmentSession: async () => { calls.submit += 1; return {}; },
    getAssessmentSession: async () => attempt,
    listAssessmentItems: async () => [],
    getPracticeAttemptItems: async () => [],
    getWrittenItems: async () => [],
    ...overrides,
  };
  const location = { pathname: '/assessment/sessions/attempt-fixture/submit/', search: '', href: '' };
  const window = { YuzanApi: api, location, setTimeout, clearTimeout };
  const context = {
    window, YuzanApi: api, document, location, URLSearchParams,
    console: { error() {}, log() {} },
    setTimeout, clearTimeout, alert: message => calls.alerts.push(message),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  const entry = formalSource.indexOf('  // ── 入口：首次渲染');
  assert.ok(entry >= 0, 'formal app exposes its page entry after the render functions');
  const source = formalSource.slice(0, entry)
    + 'window.fixture = { state: appState, render: renderSubmit, bindSubmit, saveCurrentWrittenAnswer, finalizeCurrentWrittenAnswer, hydrateWrittenAnswers, loadSubmitData };})();';
  vm.runInNewContext(source, context);
  return { ...window.fixture, calls, document, location, api, click: async selector => {
    const element = document.querySelector(selector);
    assert.ok(element, selector);
    const handler = element.listeners.get('click');
    assert.equal(typeof handler, 'function');
    await handler({ target: element, currentTarget: element });
    await tick();
  } };
}

for (const [label, values, unanswered] of [
  ['none', ['A', 'text'], 0],
  ['partial', ['A', undefined], 1],
  ['all', [undefined, undefined], 2],
]) {
  test(`Runner offers submit with ${label} unanswered`, async () => {
    const f = mountRunner();
    f.state.attempt = attempt;
    f.state.items = values.map((value, index) => answerItem(`item-${index}`, value));
    f.state.currentIndex = 1;
    f.render();

    await f.click('[data-submit]');
    assert.match(f.document.root.innerHTML, /data-confirm-submit/);
    if (unanswered) {
      assert.match(f.document.root.innerHTML, new RegExp(`当前有 ${unanswered} 道题未作答`));
      assert.match(f.document.root.innerHTML, /按零分计算/);
      assert.match(f.document.root.innerHTML, /data-fix-incomplete/);
    }
    await f.click('[data-confirm-submit]');
    assert.equal(f.calls.submit, 1);
    assert.equal(f.calls.finalize.length, 2 - unanswered);
    assert.match(f.location.href, /attempt-fixture\/processing/);
  });
}

test('Runner persists cleared text and does not finalize blank answers', async () => {
  const f = mountRunner();
  f.state.attempt = attempt;
  f.state.items = [answerItem('written', 'old answer')];
  f.render();
  f.document.querySelector('[data-text]').value = '';
  await f.click('[data-submit]');
  assert.equal(f.calls.saves[0].payload.content.value, '');
  assert.equal(f.state.items[0].studentAnswer.content.value, '');
  await f.click('[data-confirm-submit]');
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.finalize.length, 0);
});

test('Runner blocks answer-save failures and unconfirmed audio drafts', async () => {
  const saveFailure = mountRunner({ saveWrittenAnswer: async () => { throw new Error('save failed'); } });
  saveFailure.state.attempt = attempt;
  saveFailure.state.items = [answerItem('written', undefined)];
  saveFailure.render();
  await saveFailure.save(saveFailure.state.items[0], 'answer');
  await saveFailure.submit();
  assert.equal(saveFailure.calls.submit, 0);
  assert.match(saveFailure.state.error, /尚未保存/);

  const audioDraft = mountRunner();
  audioDraft.state.attempt = attempt;
  audioDraft.state.items = [answerItem('oral', undefined, 'SPEECH')];
  audioDraft.state.blob = { size: 128, type: 'audio/webm' };
  audioDraft.state.media = { state: 'REVIEW' };
  audioDraft.render();
  await audioDraft.submit();
  assert.equal(audioDraft.calls.submit, 0);
  assert.match(audioDraft.state.error, /已有录音尚未确认上传/);
});

test('formal submit accepts blank items and finalizes only nonblank saved answers', async () => {
  const f = mountFormal();
  const oral = answerItem('oral', undefined, 'SPEECH');
  const blank = answerItem('blank', undefined);
  f.state.apiSession = attempt;
  f.state.apiItems = [oral, blank];
  f.state.writtenAnswers.blank = '';
  f.state.writtenSyncStatus.blank = 'SYNCED';
  const html = f.render();
  assert.match(html, /当前有 2 道题未作答/);
  assert.match(html, /data-submit-session(?! disabled)/);
  f.document.root.innerHTML = html;
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.saves.length, 0);
  assert.equal(f.calls.finalize.length, 0);
});

test('formal submit saves a local clear and skips finalize for that answer', async () => {
  const f = mountFormal();
  f.state.apiSession = attempt;
  f.state.apiItems = [answerItem('written', undefined)];
  f.state.writtenAnswers.written = '';
  f.state.writtenSyncStatus.written = 'LOCAL';
  f.document.root.innerHTML = f.render();
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.saves[0].payload.content.text, '');
  assert.equal(f.calls.finalize.length, 0);
  assert.equal(f.calls.submit, 1);
});

test('formal submit synchronizes and finalizes real text before submitting', async () => {
  const f = mountFormal();
  f.state.apiSession = attempt;
  f.state.apiItems = [answerItem('written', undefined)];
  f.state.writtenAnswers.written = 'real answer';
  f.state.writtenSyncStatus.written = 'LOCAL';
  f.document.root.innerHTML = f.render();
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.saves.length, 1);
  assert.equal(f.calls.finalize.length, 1);
  assert.equal(f.calls.submit, 1);
});

test('formal submit data failures block stale session state', async () => {
  const f = mountFormal({ getAssessmentSession: async () => { throw new Error('offline'); } });
  f.state.apiSession = attempt;
  await f.loadSubmitData();
  assert.equal(f.state._submitLoadError, true);
  assert.match(f.render(), /data-submit-session disabled/);
});

test('formal submit still blocks a failed recording or a cancelled session', () => {
  const f = mountFormal();
  f.state.apiSession = { ...attempt, status: 'CANCELLED' };
  f.state.apiItems = [answerItem('oral', undefined, 'SPEECH')];
  assert.match(f.render(), /data-submit-session disabled/);
  f.state.apiSession = attempt;
  f.state.apiItems[0].recordingStatus = 'FAILED';
  assert.match(f.render(), /data-submit-session disabled/);
});
