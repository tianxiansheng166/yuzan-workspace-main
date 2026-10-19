import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../../', import.meta.url);
const [moduleSource, appSource, markup, styles] = await Promise.all([
  readFile(new URL('frontend/teacher/classes/detail/roster-export.js', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/app.js', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/index.html', root), 'utf8'),
  readFile(new URL('frontend/teacher/classes/detail/styles.css', root), 'utf8'),
]);

function loadExportModule() {
  const context = { window: {} };
  vm.runInNewContext(moduleSource, context, { filename: 'roster-export.js' });
  return context.window.YuzanRosterExport;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[index + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

test('CSV has UTF-8 BOM, stable headers, and supports an authorized empty class', () => {
  const csv = loadExportModule().buildCsv('TEST_FIXTURE_ONLY 七年级甲班', []);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /\r\n$/u);
  const [header] = parseCsv(csv.slice(1));
  assert.deepEqual(header, [
    '姓名', '班级', '课程进度（无数据为—）', 'Submission已完成数', 'Submission未交数',
    '最近正式分', '风险', '最近活跃',
  ]);
  assert.equal(parseCsv(csv.slice(1)).length, 1);
});

test('CSV quotes RFC 4180 separators and neutralizes formula-leading student text', () => {
  const exporter = loadExportModule();
  const dangerousNames = ['=1+1,"中文"', '+SUM(1,1)', '-2+3', '@cmd', '\t=1+1', '\r=1+1', '  =1+1', 'བོད語，学生'];
  const csv = exporter.buildCsv('TEST_FIXTURE_ONLY 班级, "一班"', dangerousNames.map((displayName) => ({
    enrollmentId: `enrollment-${displayName.length}`,
    displayName,
    courseProgress: 42,
    submittedAssignmentCount: 1,
    missingAssignmentCount: 0,
    latestAssessmentScore: null,
    riskStatus: 'OK',
    lastActiveAt: null,
  })));
  assert.match(csv, /"TEST_FIXTURE_ONLY 班级, ""一班"""/u);
  const rows = parseCsv(csv.slice(1));
  assert.equal(rows.length, dangerousNames.length + 1);
  assert.deepEqual(rows.slice(1).map((row) => row[0]), dangerousNames.map((name) => exporter.safeSpreadsheetText(name)));
  assert.ok(rows.slice(1).every((row) => row[5] === ''), 'null formal scores stay blank');
  assert.ok(rows.slice(1).every((row) => row[2] === '42%'));
});

test('zero values remain visible while null progress and score are not converted to zero', () => {
  const csv = loadExportModule().buildCsv('TEST_FIXTURE_ONLY 班级', [
    {
      enrollmentId: 'enrollment-zero', displayName: 'བོད語 零分', courseProgress: 0,
      submittedAssignmentCount: 0, missingAssignmentCount: 0, latestAssessmentScore: 0,
      riskStatus: 'AT_RISK', lastActiveAt: '2026-10-19T01:02:00.000Z',
    },
    {
      enrollmentId: 'enrollment-null', displayName: '未测评学生', courseProgress: null,
      submittedAssignmentCount: 1, missingAssignmentCount: 2, latestAssessmentScore: null,
      riskStatus: 'INACTIVE', lastActiveAt: 'invalid timestamp',
    },
  ]);
  const rows = parseCsv(csv.slice(1));
  assert.equal(rows[1][2], '0%');
  assert.equal(rows[1][5], '0');
  assert.equal(rows[1][6], '关注');
  assert.match(rows[1][7], /2026/u);
  assert.equal(rows[2][2], '—');
  assert.equal(rows[2][5], '');
  assert.equal(rows[2][7], '');
  assert.equal(rows[2][6], '不活跃');
});

test('filename is based on class scope and time without student names', () => {
  const name = loadExportModule().fileName('a8d6f6cc-contains-no-student-id', Date.UTC(2026, 9, 19));
  assert.match(name, /^班级名单学情-a8d6f6cc-/u);
  assert.doesNotMatch(name, /学生|TEST_FIXTURE_ONLY/u);
});

test('export makes a fresh scoped request, checks current identity, and never reuses page summaries', () => {
  assert.match(appSource, /\/schools\/\$\{encodeURIComponent\(identity\.schoolId\)\}\/classes\/\$\{encodeURIComponent\(identity\.classId\)\}\/student-summaries/u);
  assert.match(appSource, /method: 'GET', signal: controller\.signal/u);
  assert.match(appSource, /setTimeout\(\(\) => controller\.abort\(\), 15000\)/u);
  assert.match(appSource, /rosterExportIdentityMatches\(identity\)/u);
  assert.match(appSource, /当前已加载名单/u);
  assert.match(appSource, /没有下载旧名单/u);
  assert.match(appSource, /window\.confirm\(/u);
  assert.match(appSource, /YuzanRosterExport\.buildCsv\(className, summaries\)/u);
  assert.doesNotMatch(appSource, /buildCsv\(className, studentSummaries\)/u);
  assert.doesNotMatch(appSource, /export: '导出班级报表功能暂未开通'/u);
});

test('export controls and status are keyboard and screen reader discoverable at narrow widths', () => {
  assert.match(markup, /data-action="export" aria-label="导出名单\/学情CSV"/u);
  assert.match(markup, /id="rosterExportStatus" role="status" aria-live="polite"/u);
  assert.match(markup, /src="\/teacher\/classes\/detail\/roster-export\.js"/u);
  assert.match(styles, /\.roster-export-button:disabled/u);
  assert.match(styles, /@media\(max-width:900px\)[\s\S]*?\.roster-table-wrap\{overflow:visible\}/u);
  assert.match(styles, /prefers-reduced-motion:reduce/u);
});
