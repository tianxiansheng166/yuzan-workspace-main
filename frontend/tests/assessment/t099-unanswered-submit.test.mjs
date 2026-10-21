import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const runner = readFileSync(new URL('../../assessment/assets/runner.js', import.meta.url), 'utf8');
const formal = readFileSync(new URL('../../assessment/assets/app.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const attempt = { id: 'attempt-t099', status: 'IN_PROGRESS', enrollmentId: 'fixture-enrollment' };
const item = (id, value, type = 'TEXT') => ({
  id, itemType: type === 'SPEECH' ? 'SPEECH' : 'WRITTEN',
  prompt: { stimulus: { type: 'TEXT', promptText: 'VISUAL_FIXTURE_ONLY' }, response: { type } },
  studentAnswer: value === undefined ? null : { content: { value } },
});

function dom() {
  let html = '';
  let elements = new Map();
  const root = { get innerHTML() { return html; }, set innerHTML(value) { html = value; elements = new Map(); } };
  const querySelector = selector => {
    if (selector === '#app') return root;
    const attribute = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!attribute && !selector.startsWith('.')) return null;
    if (!html.includes(attribute || selector.slice(1))) return null;
    if (!elements.has(selector)) elements.set(selector, {
      dataset: {}, style: {}, listeners: new Map(), disabled: false, hidden: false,
      value: selector === '[data-text]' ? html.match(/<textarea[^>]*data-text[^>]*>(.*?)<\/textarea>/s)?.[1] || '' : '',
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      focus() {}, setAttribute() {},
    });
    return elements.get(selector);
  };
  return { root, querySelector, querySelectorAll: () => [], getElementById: () => root, body: { dataset: { page: 'submit' } } };
}

function mount(kind = 'runner', overrides = {}) {
  const document = dom();
  const calls = { submit: 0, finalize: [], saves: [], retry: 0, routes: [] };
  const api = {
    getToken: () => 'FIXTURE_TOKEN', requireAuth: () => true,
    getCoursePracticeContext: () => null,
    saveWrittenAnswer: async (attemptId, id, payload) => { calls.saves.push({ attemptId, id, payload }); },
    finalizeWrittenAnswer: async (attemptId, id) => { calls.finalize.push({ attemptId, id }); },
    submitAssessmentSession: async () => { calls.submit += 1; return {}; },
    getPracticeAttempt: async () => attempt,
    getPracticeAttemptItems: async () => [],
    getAssessmentSession: async () => attempt,
    listAssessmentItems: async () => [],
    getWrittenItems: async () => [],
    ...overrides,
  };
  const context = {
    YuzanApi: api, document, console: { error() {}, log() {} }, URLSearchParams,
    setTimeout, clearTimeout, setInterval, clearInterval, addEventListener() {},
    location: { pathname: kind === 'runner' ? '/student/practices/attempts/attempt-t099/runner/' : '/assessment/sessions/attempt-t099/submit/', search: '', assign: route => calls.routes.push(route) },
    alert: message => { calls.alert = message; },
    window: { YuzanApi: api, addEventListener() {}, setTimeout, clearTimeout },
  };
  // Expose the actual closure only in the VM test copy. No production test hook.
  const source = kind === 'runner'
    ? runner.replace('  boot();', '  window.fixture = { state, render, submit, save, flush, retryCourseSync };')
    : formal.slice(0, formal.indexOf('  // ── 入口：首次渲染')) + 'window.fixture = { state: appState, render: renderSubmit, bindSubmit, saveCurrentWrittenAnswer, finalizeCurrentWrittenAnswer, hydrateWrittenAnswers, loadSubmitData };})();';
  vm.runInNewContext(source, context);
  const fixture = context.window.fixture;
  if (kind === 'runner') Object.assign(fixture.state, { attempt, items: [item('written') ] });
  else Object.assign(fixture.state, { apiSession: attempt, apiItems: [item('oral', undefined, 'SPEECH'), item('written')] });
  const click = async selector => {
    const element = document.querySelector(selector);
    assert.ok(element, selector);
    const handler = element.listeners.get('click');
    assert.equal(typeof handler, 'function');
    await handler({ target: element, currentTarget: element });
    await tick();
  };
  return { ...fixture, calls, document, click, api, context };
}

for (const [label, values, missing] of [ ['zero', ['A', 'text'], 0], ['some', ['A', undefined], 1], ['all', [undefined, undefined], 2] ]) {
  test(`Runner confirmation permits submit with ${label} unanswered`, async () => {
    const f = mount();
    f.state.items = values.map((v, i) => item(`item-${i}`, v));
    f.state.currentIndex = 1;
    f.render();
    await f.click('[data-submit]');
    assert.match(f.document.root.innerHTML, /data-confirm-submit/);
    if (missing) {
      assert.match(f.document.root.innerHTML, new RegExp(`当前有 ${missing} 道题未作答`));
      assert.match(f.document.root.innerHTML, /按零分计算/);
      assert.match(f.document.root.innerHTML, /data-fix-incomplete/);
    }
    await f.click('[data-confirm-submit]');
    assert.equal(f.calls.submit, 1);
    assert.equal(f.calls.finalize.length, 2 - missing);
    assert.match(f.calls.routes[0], /attempt-t099\/processing/);
  });
}

test('Runner persists cleared saved text and skips blank finalize', async () => {
  const f = mount();
  f.state.items = [item('written', 'old answer')];
  f.render();
  f.document.querySelector('[data-text]').value = '';
  await f.click('[data-submit]');
  assert.equal(f.calls.saves[0].payload.content.value, '');
  assert.equal(f.state.items[0].studentAnswer.content.value, '');
  await f.click('[data-confirm-submit]');
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.finalize.length, 0);
});

test('Runner retains pending save failure as a technical blocker', async () => {
  const f = mount('runner', { saveWrittenAnswer: async () => { throw Object.assign(new Error('save failed'), { status: 400 }); } });
  f.render();
  await f.save(f.state.items[0], 'real answer');
  await f.submit();
  assert.equal(f.calls.submit, 0);
  assert.equal(f.state.pendingAnswers.get('written'), 'real answer');
  assert.match(f.state.error, /尚未保存/);
});

test('Runner locks an uncertain submit until the server state is reconciled', async () => {
  let sent = 0;
  const f = mount('runner', {
    submitAssessmentSession: async () => { sent += 1; throw new Error('lost response'); },
    getPracticeAttempt: async () => { throw new Error('offline'); },
  });
  f.render();
  await f.submit();
  assert.equal(f.state.submitVerificationPending, true);
  await f.submit();
  assert.equal(sent, 1);
  assert.equal(f.calls.routes.length, 0);
});

test('all-blank Runner preserves course-sync recovery without duplicate submit', async () => {
  let sent = 0;
  let retries = 0;
  const f = mount('runner', {
    submitAssessmentSession: async () => { sent += 1; return { courseSync: { pending: true, submitted: true } }; },
    retryCoursePracticeCompletion: async () => { retries += 1; return { linked: true, serverConfirmed: true, navigateTo: '/student/courses/course-detail/?id=fixture' }; },
  });
  f.render();
  await f.submit();
  assert.equal(f.state.courseSyncPending.submitted, true);
  await f.retryCourseSync();
  assert.equal(sent, 1);
  assert.equal(retries, 1);
  assert.equal(f.calls.routes[0], '/student/courses/course-detail/?id=fixture');
});

test('formal all-blank submit is enabled and does not finalize nonexistent answers', async () => {
  const f = mount('formal');
  const html = f.render();
  assert.match(html, /当前有 2 道题未作答/);
  assert.match(html, /data-submit-session >/);
  f.document.root.innerHTML = html;
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.submit, 1);
  assert.equal(f.calls.saves.length, 0);
  assert.equal(f.calls.finalize.length, 0);
});

test('formal preserves a local clear across hydration, saves it, and skips finalize', async () => {
  const f = mount('formal');
  f.state.writtenAnswers.written = '';
  f.state.writtenSyncStatus.written = 'LOCAL';
  f.hydrateWrittenAnswers([{ id: 'written', answer: { content: { text: 'old answer' }, finalSubmittedAt: 'old' } }]);
  assert.equal(f.state.writtenAnswers.written, '');
  f.document.root.innerHTML = f.render();
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.saves[0].payload.content.text, '');
  assert.equal(f.calls.finalize.length, 0);
  assert.equal(f.calls.submit, 1);
});

test('formal synchronizes and finalizes real text before submitting', async () => {
  const f = mount('formal');
  f.state.writtenAnswers.written = 'real answer';
  f.state.writtenSyncStatus.written = 'LOCAL';
  f.document.root.innerHTML = f.render();
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.saves.length, 1);
  assert.equal(f.calls.finalize.length, 1);
  assert.equal(f.calls.submit, 1);
});

test('formal save failures still stop submission', async () => {
  const f = mount('formal', { saveWrittenAnswer: async () => { throw new Error('offline'); } });
  f.state.writtenAnswers.written = 'real answer';
  f.state.writtenSyncStatus.written = 'LOCAL';
  f.document.root.innerHTML = f.render();
  f.bindSubmit();
  await f.click('[data-submit-session]');
  assert.equal(f.calls.submit, 0);
  assert.match(f.calls.alert, /offline/);
});

test('formal invalid session and failed recording remain blocked', () => {
  const f = mount('formal');
  f.state.apiSession = { ...attempt, status: 'CANCELLED' };
  assert.match(f.render(), /data-submit-session disabled/);
  f.state.apiSession = attempt;
  f.state.apiItems[0].recordingStatus = 'FAILED';
  assert.match(f.render(), /data-submit-session disabled/);
});

test('formal blank next action persists a clear without finalizing it', async () => {
  const f = mount('formal');
  f.state.writtenAnswers.written = '  ';
  await f.finalizeCurrentWrittenAnswer({ id: 'written' });
  assert.equal(f.calls.saves[0].payload.content.text, '  ');
  assert.equal(f.calls.finalize.length, 0);
  await f.finalizeCurrentWrittenAnswer({ id: 'untouched' });
  assert.equal(f.calls.saves.length, 1);
});

test('formal submit data network failure blocks use of stale session state', async () => {
  const f = mount('formal', { getAssessmentSession: async () => { throw new Error('offline'); } });
  await f.loadSubmitData();
  assert.equal(f.state._submitLoadError, true);
  assert.match(f.render(), /data-submit-session disabled/);
});

test('Runner retains upload verification for an actual local audio draft', async () => {
  const f = mount();
  f.state.items = [item('oral', undefined, 'SPEECH')];
  f.state.blob = { size: 128, type: 'audio/webm' };
  f.state.media = { state: 'REVIEW', cached: true };
  f.render();
  await f.submit();
  assert.equal(f.calls.submit, 0);
  assert.match(f.state.error, /已有录音尚未确认上传/);
});
