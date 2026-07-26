import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appSource = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const legacySource = await readFile(new URL('./login.js', import.meta.url), 'utf8');
const clientSource = await readFile(new URL('../assets/api-client.js', import.meta.url), 'utf8');

for (const [name, source] of [['app.js', appSource], ['login.js', legacySource]]) {
  for (const forbidden of ['demo-token-', 'yuzan-demo-session', '演示模式登录成功', '已使用本机凭据登录']) {
    assert.equal(source.includes(forbidden), false, `${name} must not contain ${forbidden}`);
  }
}
for (const forbidden of ['demo-token-', "setItem('yuzan-demo-session'", '演示模式登录成功', '已使用本机凭据登录']) {
  assert.equal(clientSource.includes(forbidden), false, `api-client.js must not contain ${forbidden}`);
}

function createClient(fetchImpl) {
  const values = new Map([
    ['yuzan-access-token', 'stale-token'],
    ['yuzan-current-user', '{"id":"stale-user"}'],
    ['yuzan-active-school-id', 'stale-school'],
  ]);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const window = { localStorage };
  const context = vm.createContext({
    window,
    localStorage,
    fetch: fetchImpl,
    location: { href: '' },
    URLSearchParams,
    Blob,
    FormData,
    Date,
    Error,
    JSON,
    console,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(clientSource, context, { filename: 'api-client.js' });
  return { api: window.YuzanApi, values };
}

function assertNoSession(values) {
  assert.equal(values.has('yuzan-access-token'), false);
  assert.equal(values.has('yuzan-current-user'), false);
  assert.equal(values.has('yuzan-active-school-id'), false);
}

{
  const { api, values } = createClient(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { accessToken: '', user: null } }),
  }));
  await assert.rejects(() => api.login('teacher.test', 'not-a-real-password'), (error) => error.code === 'AUTH_SESSION_INVALID');
  assertNoSession(values);
}

{
  const { api, values } = createClient(async () => { throw new TypeError('network unavailable'); });
  await assert.rejects(() => api.login('student.test', 'not-a-real-password'), /network unavailable/);
  assertNoSession(values);
}

console.log('[PASS] login client rejects missing sessions and network failure without persisted auth');
