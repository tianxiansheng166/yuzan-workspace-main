(() => {
  'use strict';

  const HEADERS = [
    '姓名',
    '班级',
    '课程进度（无数据为—）',
    'Submission已完成数',
    'Submission未交数',
    '最近正式分',
    '风险',
    '最近活跃',
  ];

  const RISK_LABELS = Object.freeze({
    OK: '正常',
    AT_RISK: '关注',
    INACTIVE: '不活跃',
  });

  function safeSpreadsheetText(value) {
    const text = String(value ?? '');
    if (/^[\t\r\n]/u.test(text) || /^\s*[=+\-@]/u.test(text)) return `'${text}`;
    return text;
  }

  function csvField(value) {
    const safeValue = safeSpreadsheetText(value);
    return `"${safeValue.replace(/"/gu, '""')}"`;
  }

  function countCell(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? String(value) : '';
  }

  function progressCell(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
      ? `${value}%`
      : '—';
  }

  function scoreCell(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  }

  function activityCell(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(date);
    } catch {
      return '';
    }
  }

  function buildCsv(className, summaries) {
    if (typeof className !== 'string' || !className.trim()) {
      throw new TypeError('班级名称不可用');
    }
    if (!Array.isArray(summaries)) throw new TypeError('学生名单响应格式不可用');

    const records = summaries.map((student) => [
      typeof student?.displayName === 'string' ? student.displayName : '',
      className,
      progressCell(student?.courseProgress),
      countCell(student?.submittedAssignmentCount),
      countCell(student?.missingAssignmentCount),
      scoreCell(student?.latestAssessmentScore),
      RISK_LABELS[student?.riskStatus] || '',
      activityCell(student?.lastActiveAt),
    ]);

    return `\uFEFF${[HEADERS, ...records].map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
  }

  function fileName(classId, now = Date.now()) {
    const classTag = String(classId ?? '').replace(/[^a-zA-Z0-9-]/gu, '').slice(0, 8) || 'current';
    const timestamp = new Date(now).toISOString().replace(/[:.]/gu, '-');
    return `班级名单学情-${classTag}-${timestamp}.csv`;
  }

  window.YuzanRosterExport = Object.freeze({
    HEADERS: Object.freeze(HEADERS),
    buildCsv,
    fileName,
    safeSpreadsheetText,
  });
})();
