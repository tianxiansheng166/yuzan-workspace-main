import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../../', import.meta.url);
const [classMarkup, classApp, classStyles, apiSource, invitationService, openapi, generated] = await Promise.all([
  readFile(new URL('frontend/teacher/classes/detail/index.html', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/app.js', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/styles.css', root), 'utf8'),
  readFile(new URL('frontend/assets/api-client.js', root), 'utf8'),
  readFile(new URL('backend/api/src/modules/teacher-invitations/teacher-invitations.service.ts', root), 'utf8'),
  readFile(new URL('packages/contracts/openapi/openapi.yaml', root), 'utf8'),
  readFile(new URL('packages/contracts/src/generated.ts', root), 'utf8'),
]);

test('revoke control is rendered only for a server-active credential', () => {
  assert.match(classApp, /const isUsable = status === 'ACTIVE' && typeof item\.code === 'string'/);
  assert.match(classApp, /const revokeMarkup = isUsable/);
  assert.match(classApp, /data-revoke-invitation=/);
  assert.match(classApp, /records\.filter\(\(item\) => item\?\.class\?\.id === classId\)/);
});

test('confirmation warns about retained students and uses a labelled native modal', () => {
  assert.match(classMarkup, /撤销后不能再让新学生加入；已经入班的学生不会移除/);
  assert.match(classMarkup, /<dialog class="invitation-revoke-dialog" id="invitationRevokeDialog"/);
  assert.match(classMarkup, /aria-labelledby="invitationRevokeTitle" aria-describedby="invitationRevokeWarning"/);
  assert.match(classApp, /handleInvitationRevokeTabKey/);
  assert.match(classApp, /if \(invitationRevokeInFlight\) event\.preventDefault\(\)/);
});

test('unknown response performs one list reconciliation and masks the pending credential', () => {
  assert.match(classApp, /await YuzanApi\.revokeTeacherInvitation\(invitationId\)/);
  assert.match(classApp, /const refreshed = await loadTeacherInvitations\(\)/);
  assert.match(classApp, /post-confirmed/);
  assert.match(classApp, /post-unconfirmed/);
  assert.match(classApp, /不会再次提交撤销/);
  assert.match(classApp, /撤销结果待服务器核实，凭证暂时隐藏/);
  assert.match(classApp, /current\?\.status === 'REVOKED'/);
});

test('inactive cards redact code and keep the bespoke paper cancellation seal', () => {
  assert.match(invitationService, /code: status === "ACTIVE" \? invitation\.code : null/);
  assert.match(classApp, /invitation-revoke-seal/);
  assert.match(classStyles, /\.invitation-record\.is-revoked:before/);
  assert.match(classStyles, /prefers-reduced-motion:reduce/);
  assert.match(classMarkup, /invitation-cancellation-mark/);
});

test('revoke API client posts to the active school and the generated route matches OpenAPI', async () => {
  const values = new Map([
    ['yuzan-active-school-id', 'school-t028'],
    ['yuzan-access-token', 'fixture-access-token'],
  ]);
  const calls = [];
  const context = {
    window: { location: { origin: 'http://localhost' } },
    location: { origin: 'http://localhost', href: '' },
    URL,
    URLSearchParams,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, status: 200, json: async () => ({ data: { id: 'invitation-t028', status: 'REVOKED', code: null } }) };
    },
  };
  vm.runInNewContext(apiSource, context, { filename: 'api-client.js' });
  const result = await context.window.YuzanApi.revokeTeacherInvitation('invitation-t028');

  const request = calls[0];
  assert.equal(new URL(request.url, 'http://localhost').pathname, '/api/v1/schools/school-t028/teacher-invitations/invitation-t028/revoke');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.body, undefined);
  assert.equal(request.options.headers.Authorization, 'Bearer fixture-access-token');
  assert.equal(result.status, 'REVOKED');
  assert.match(openapi, /\/schools\/\{schoolId\}\/teacher-invitations\/\{invitationId\}\/revoke:/);
  assert.match(openapi, /operationId: revokeTeacherInvitation/);
  assert.match(generated, /"\/schools\/\{schoolId\}\/teacher-invitations\/\{invitationId\}\/revoke"/);
  assert.match(generated, /revokeTeacherInvitation: \{/);
});
