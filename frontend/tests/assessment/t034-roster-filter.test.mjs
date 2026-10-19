import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../../', import.meta.url);
const [filterSource, appSource, markup, styles] = await Promise.all([
  readFile(new URL('frontend/teacher/classes/detail/roster-filter.js', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/app.js', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/index.html', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/styles.css', root), 'utf8'),
]);

function filterModule() {
  const context = { window: {} };
  vm.runInNewContext(filterSource, context, { filename: 'roster-filter.js' });
  return context.window.YuzanRosterFilter;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const rows = [
  { enrollmentId: 'same-z', displayName: '同名学生', riskStatus: 'OK', courseProgress: 0, latestAssessmentScore: 0, lastActiveAt: '2026-10-19T05:00:00.000Z' },
  { enrollmentId: 'same-a', displayName: '同名学生', riskStatus: 'AT_RISK', courseProgress: 75, latestAssessmentScore: null, lastActiveAt: '2026-10-18T05:00:00.000Z' },
  { enrollmentId: 'inactive', displayName: 'བོད語学生', riskStatus: 'INACTIVE', courseProgress: null, latestAssessmentScore: null, lastActiveAt: null },
  { enrollmentId: 'future-risk', displayName: '未知风险学生', riskStatus: 'FUTURE_STATUS', courseProgress: 100, latestAssessmentScore: 86, lastActiveAt: '2026-10-19T06:00:00.000Z' },
];

test('real-name search normalizes Unicode and keeps distinct same-name enrollment IDs', () => {
  const filter = filterModule();
  const result = filter.filterAndSort(rows, { search: '  同名学生 ', sort: 'name' });
  assert.deepEqual(plain(result.map((row) => row.enrollmentId)), ['same-a', 'same-z']);
  assert.equal(filter.filterAndSort(rows, { search: 'བོད語', sort: 'name' })[0].enrollmentId, 'inactive');
  assert.equal(filter.filterAndSort(rows, { search: '％', sort: 'name' }).length, 0);
  const bounded = filter.sanitizeState({ search: `${'a'.repeat(79)}😀z` }).search;
  assert.equal(Array.from(bounded).length, 80);
  assert.equal(bounded.endsWith('😀'), true);
});

test('risk filter accepts only server states and treats absent or future states as neutral unknown', () => {
  const filter = filterModule();
  assert.deepEqual(plain(filter.filterAndSort(rows, { risk: 'AT_RISK' }).map((row) => row.enrollmentId)), ['same-a']);
  assert.deepEqual(plain(filter.filterAndSort(rows, { risk: 'UNKNOWN' }).map((row) => row.enrollmentId)), ['future-risk']);
  assert.equal(filter.riskGroup(null), 'UNKNOWN');
  assert.equal(filter.riskGroup('FUTURE_STATUS'), 'UNKNOWN');
  assert.equal(filter.sanitizeState({ risk: 'CRITICAL' }).risk, '');
  assert.match(appSource, /riskGroup\(s\.riskStatus\)/u);
  assert.match(appSource, /'risk-unknown'/u);
  assert.match(appSource, /: '未知'/u);
});

test('formal score filter preserves score zero separately from null', () => {
  const filter = filterModule();
  assert.equal(filter.hasFormalScore(0), true);
  assert.equal(filter.hasFormalScore(null), false);
  assert.deepEqual(plain(filter.filterAndSort(rows, { score: 'SCORED' }).map((row) => row.enrollmentId).sort()), ['future-risk', 'same-z']);
  assert.deepEqual(plain(filter.filterAndSort(rows, { score: 'NO_SCORE' }).map((row) => row.enrollmentId).sort()), ['inactive', 'same-a']);
});

test('recent activity and course progress sort descending with nulls last and stable ID ties', () => {
  const filter = filterModule();
  assert.deepEqual(plain(filter.filterAndSort(rows, { sort: 'activity' }).map((row) => row.enrollmentId)), ['future-risk', 'same-z', 'same-a', 'inactive']);
  assert.deepEqual(plain(filter.filterAndSort(rows, { sort: 'progress' }).map((row) => row.enrollmentId)), ['future-risk', 'same-a', 'same-z', 'inactive']);
});

test('query state is allowlisted, preserves unrelated route context, and removes invalid enum values', () => {
  const filter = filterModule();
  const params = filter.writeParams(new URLSearchParams('schoolId=school-a&studentId=enrollment-x&rosterRisk=CRITICAL&rosterSort=invalid'), {
    search: '  ＡＢＣ  ', risk: 'AT_RISK', score: 'NO_SCORE', sort: 'progress',
  });
  assert.equal(params.get('schoolId'), 'school-a');
  assert.equal(params.get('studentId'), 'enrollment-x');
  assert.equal(params.get('rosterSearch'), 'ABC');
  assert.equal(params.get('rosterRisk'), 'AT_RISK');
  assert.equal(params.get('rosterScore'), 'NO_SCORE');
  assert.equal(params.get('rosterSort'), 'progress');
  assert.equal(filter.hasLegalStateParam(new URLSearchParams('rosterRisk=CRITICAL')), false);
  assert.deepEqual(plain(filter.stateFromParams(new URLSearchParams('rosterRisk=CRITICAL&rosterSort=old'))), {
    search: '', risk: '', score: '', sort: 'name',
  });
});

test('class page retains only identity-scoped filter state and discards stale async data', () => {
  assert.match(appSource, /sessionStorage\.setItem\(rosterFilterStorageKey/u);
  assert.match(appSource, /saved\?\.userId === pageIdentity\?\.userId/u);
  assert.match(appSource, /saved\?\.schoolId === schoolId/u);
  assert.match(appSource, /pageIdentityMatches\(identity\)/u);
  assert.match(appSource, /rosterRequestController\.abort\(\)/u);
  assert.match(appSource, /isCurrentPageRequest\(pageIdentity, epoch\)/u);
  assert.match(appSource, /studentSummaries = \[\]/u);
  assert.match(appSource, /\/teacher\/students\/\$\{encodeURIComponent\(s\.enrollmentId\)\}/u);
});

test('filters expose formal-score state and whole-class CSV scope at all sizes', () => {
  assert.match(markup, /id="rosterScore"/u);
  assert.match(markup, /id="rosterCount" role="status" aria-live="polite"/u);
  assert.match(markup, /导出全班名单CSV/u);
  assert.match(markup, /不受当前搜索和筛选影响/u);
  assert.match(styles, /\.risk-unknown/u);
  assert.match(styles, /@media\(max-width:900px\)[\s\S]*?\.roster-row:not\(\.header\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(styles, /@media\(max-width:430px\)[\s\S]*?\.roster-filters\{grid-template-columns:minmax\(0,1fr\)\}/u);
  assert.match(styles, /prefers-reduced-motion:reduce/u);
});
