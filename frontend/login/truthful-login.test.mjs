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

function createClient(fetchImpl, options = {}) {
  const values = new Map(options.initialValues ?? [
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
  const documentElement = { style: { visibility: '' } };
  const location = {
    href: '',
    pathname: options.pathname ?? '/login',
    replace(url) {
      this.href = url;
    },
  };
  const context = vm.createContext({
    window,
    localStorage,
    fetch: fetchImpl,
    location,
    document: { documentElement },
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
  return { api: window.YuzanApi, values, location, documentElement };
}

function assertNoSession(values) {
  assert.equal(values.has('yuzan-access-token'), false);
  assert.equal(values.has('yuzan-current-user'), false);
  assert.equal(values.has('yuzan-active-school-id'), false);
}

function successfulMe(role, schoolId) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        id: `${role.toLowerCase()}-1`,
        displayName: `${role.toLowerCase()} user`,
        preferredLocale: 'zh-CN',
        memberships: [{ role, schoolId }],
        activeSchoolId: schoolId,
      },
    }),
  };
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

{
  const requestedPaths = [];
  const { api, values, location, documentElement } = createClient(async (path) => {
    requestedPaths.push(path);
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Session revoked' } }),
    };
  }, { pathname: '/teacher/' });
  assert.equal(documentElement.style.visibility, 'hidden');
  assert.equal(await api.whenSessionReady(), false);
  assert.deepEqual(requestedPaths, ['/api/v1/me']);
  assertNoSession(values);
  assert.equal(location.href, '/login');
  assert.equal(documentElement.style.visibility, 'hidden');
}

{
  let fetchCount = 0;
  const { api, values, location, documentElement } = createClient(async () => {
    fetchCount += 1;
    throw new Error('fresh context must redirect without an API request');
  }, { pathname: '/teacher/', initialValues: [] });
  assert.equal(documentElement.style.visibility, 'hidden');
  assert.equal(await api.whenSessionReady(), false);
  assert.equal(fetchCount, 0);
  assertNoSession(values);
  assert.equal(location.href, '/login');
}

{
  const { api, values, location, documentElement } = createClient(
    async () => successfulMe('TEACHER', 'school-1'),
    { pathname: '/teacher/' },
  );
  assert.equal(await api.whenSessionReady(), true);
  assert.equal(location.href, '');
  assert.equal(documentElement.style.visibility, '');
  assert.equal(JSON.parse(values.get('yuzan-current-user')).id, 'teacher-1');
  assert.equal(values.get('yuzan-active-school-id'), 'school-1');
}

{
  const { api, values, location, documentElement } = createClient(
    async () => successfulMe('STUDENT', 'student-school'),
    { pathname: '/student/today' },
  );
  assert.equal(await api.whenSessionReady(), true);
  assert.equal(location.href, '');
  assert.equal(documentElement.style.visibility, '');
  assert.equal(JSON.parse(values.get('yuzan-current-user')).id, 'student-1');
  assert.equal(values.get('yuzan-active-school-id'), 'student-school');
}

for (const scenario of [
  { pathname: '/teacher', role: 'STUDENT', schoolId: 'student-school', destination: '/student/today' },
  { pathname: '/student/today', role: 'TEACHER', schoolId: 'teacher-school', destination: '/teacher' },
]) {
  const { api, values, location, documentElement } = createClient(
    async () => successfulMe(scenario.role, scenario.schoolId),
    { pathname: scenario.pathname },
  );
  assert.equal(documentElement.style.visibility, 'hidden');
  assert.equal(await api.whenSessionReady(), false);
  assert.equal(location.href, scenario.destination);
  assert.equal(documentElement.style.visibility, 'hidden');
  assert.equal(values.get('yuzan-access-token'), 'stale-token');
  assert.equal(JSON.parse(values.get('yuzan-current-user')).memberships[0].role, scenario.role);
  assert.equal(values.get('yuzan-active-school-id'), scenario.schoolId);
}

console.log('[PASS] login and protected entry enforce server-confirmed active roles and revoked sessions');
