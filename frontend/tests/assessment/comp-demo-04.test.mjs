import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const assessmentSource = await readFile(new URL('../../assessment/assets/app.js', import.meta.url), 'utf8');
const runnerSource = await readFile(new URL('../../assessment/assets/runner.js', import.meta.url), 'utf8');
const reviewSource = await readFile(new URL('../../teacher/reviews/detail.js', import.meta.url), 'utf8');

const session = {
  id: 'session-comp-demo-04',
  type: 'MIXED',
  purpose: 'STANDARD',
  status: 'PROCESSING',
  submittedAt: '2026-09-07T10:00:00.000Z',
};

const readingItem = {
  id: 'item-reading-04',
  itemType: 'READ_ALOUD',
  status: 'REVIEWED',
  maxScore: 4,
  recordingId: 'recording-04',
  prompt: { text: '春风又绿江南岸' },
  autoResult: {
    state: 'NEEDS_REVIEW',
    strategy: 'SPEECH_READING',
    provider: 'iflytek',
    scorerVersion: 'ise-v1',
    candidatePoints: 3,
    maxScore: 4,
    metrics: { accuracy: 91, completeness: null, fluency: 77, tone: 84, overall: 82 },
    calibrationStatus: 'UNCALIBRATED',
    finalizable: false,
    requiresReview: true,
  },
};

function runAssessment({ report = null, item = readingItem } = {}) {
  const appRoot = { innerHTML: '' };
  const storageData = new Map([
    ['yuzan-assessment-v5-session-comp-demo-04', JSON.stringify({ apiSession: session, apiItems: [item], apiReport: report })],
  ]);
  const api = {
    getToken: () => 'test-token',
    getPracticeAttempt: async () => session,
    getPracticeAttemptItems: async () => [item],
    getAssessmentReport: async () => report,
  };
  const context = vm.createContext({
    YuzanApi: api,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    location: { pathname: '/student/practices/attempts/session-comp-demo-04/report/', search: '' },
    localStorage: {
      getItem: (key) => storageData.get(key) ?? null,
      setItem: (key, value) => storageData.set(key, value),
      removeItem: (key) => storageData.delete(key),
    },
    document: {
      body: { dataset: { page: 'report' } },
      getElementById: (id) => id === 'app' ? appRoot : null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: { YuzanApi: api, setTimeout, clearTimeout },
  });
  vm.runInContext(assessmentSource, context, { filename: 'frontend/assessment/assets/app.js' });
  return new Promise((resolve) => setTimeout(() => resolve(appRoot.innerHTML), 10));
}

function runReview(detail) {
  const button = { addEventListener() {} };
  const root = {
    innerHTML: '',
    querySelector: (selector) => selector === '[data-review-submit]' ? button : null,
  };
  const api = {
    requireAuth: () => true,
    getAssessmentReviewDetail: async () => detail,
  };
  const context = vm.createContext({
    YuzanApi: api,
    location: { pathname: '/teacher/reviews/item-reading-04' },
    document: { querySelector: () => root },
    window: { YuzanApi: api },
  });
  vm.runInContext(reviewSource, context, { filename: 'frontend/teacher/reviews/detail.js' });
  return new Promise((resolve) => setTimeout(() => resolve(root.innerHTML), 10));
}

test('formal report takes precedence over a retained provisional ISE result', async () => {
  const formal = { overallScore: 76, dataCompleteness: 100, generatedAt: '2026-09-07T10:10:00.000Z', summary: { scoringState: 'AUTO_RESULT', requiresTeacherReview: false }, diagnosis: null };
  const html = await runAssessment({ report: formal });
  assert.match(html, /总体得分/);
  assert.match(html, /教师已复核/);
  assert.doesNotMatch(html, /这一次的声音，已经被认真保存/);
  assert.doesNotMatch(html, /进入针对性强化/);
});

test('provisional ISE report keeps a non-remediation learning action', async () => {
  const html = await runAssessment({ report: null, item: { ...readingItem, status: 'PENDING' } });
  assert.match(html, /自动结果仅用于学习诊断/);
  assert.match(html, /继续朗读练习/);
  assert.match(html, /教师复核后将基于正式诊断生成专项巩固/);
  assert.doesNotMatch(html, /进入针对性强化/);
});

test('teacher reading review renders safe ISE dimensions and keeps formal score independent', async () => {
  const html = await runReview({
    student: { displayName: '王雨晴' },
    practice: { title: '《春》生字认读与易错音纠正' },
    item: { strategy: 'SPEECH_READING', domain: 'SPEAK', maxScore: 4, state: 'PENDING', targetText: '春风又绿江南岸', scoredScore: null, prompt: {} },
    review: { rubric: ['按朗读准确、完整、流利和声调综合判断'] },
    evidence: {
      playbackUrl: 'https://example.test/recording.wav',
      mimeType: 'audio/wav',
      durationMs: 4200,
      speechJobStatus: 'NEEDS_REVIEW',
      diagnostic: readingItem.autoResult,
      transcript: null,
    },
  });
  assert.match(html, /同一条原始录音/);
  assert.match(html, /科大讯飞 ISE/);
  assert.match(html, /NEEDS_REVIEW/);
  assert.match(html, /未校准/);
  assert.match(html, /自动诊断证据/);
  for (const label of ['准确度', '完整度', '流利度', '声调']) assert.match(html, new RegExp(label));
  assert.match(html, /本次未提供/);
  assert.match(html, /自动参考值/);
  assert.match(html, /不会自动填入正式得分/);
  assert.match(html, /data-review-score[^>]*value=""/);
  assert.doesNotMatch(html, /本地语音诊断/);
});

test('teacher open-response detail keeps its local diagnostics path', async () => {
  const html = await runReview({
    student: { displayName: '王雨晴' },
    practice: { title: '练习' },
    item: { strategy: 'SPEECH_OPEN_RESPONSE', domain: 'SPEAK', maxScore: 14, state: 'PENDING', prompt: {} },
    review: { rubric: [] },
    evidence: { speechJobStatus: 'NEEDS_REVIEW', diagnostic: { diagnostics: { durationMs: 1200, fluency: 0.8 } } },
  });
  assert.match(html, /本地语音诊断/);
  assert.match(html, /1200 ms/);
});

test('teacher open-response detail explains unsupported automatic analysis without inventing diagnostics', async () => {
  const html = await runReview({
    student: { displayName: '王雨晴' },
    practice: { title: '练习' },
    item: { strategy: 'SPEECH_OPEN_RESPONSE', domain: 'SPEAK', maxScore: 14, state: 'PENDING', prompt: {} },
    review: { rubric: ['依据真实录音评分'] },
    evidence: {
      playbackUrl: 'https://example.test/recording.wav',
      speechJobStatus: 'FAILED',
      errorCode: 'PROVIDER_TASK_UNSUPPORTED',
      diagnostic: null,
    },
  });
  assert.match(html, /自动语义分析未启用/);
  assert.match(html, /请依据原始录音人工复核/);
  assert.doesNotMatch(html, /本地语音诊断/);
  assert.doesNotMatch(html, /1200 ms/);
});

test('browser-facing sources do not include provider raw audit fields', () => {
  assert.doesNotMatch(reviewSource, /providerAudit|rawResponse/);
});

test('unified runner exposes a normal re-record path for a failed historical recording', () => {
  assert.match(runnerSource, /recordingStatus === 'FAILED'/);
  assert.match(runnerSource, /历史录音不会被覆盖/);
  assert.match(runnerSource, /recordingIdempotencyKey/);
  assert.match(runnerSource, /crypto\.randomUUID\(\)/);
  assert.match(runnerSource, /data-start-recording/);
});
