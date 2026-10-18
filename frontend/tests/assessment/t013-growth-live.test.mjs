import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(
  new URL("../../student/growth/assets/growth-live.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

const emptyProgress = () => ({
  version: "qb-progress-v1",
  state: "EMPTY_STATE",
  formalLevels: [],
  remediation: [],
  milestones: [],
  latest: null,
});

function mount(overrides = {}) {
  const elements = new Map();
  const element = () => ({
    dataset: {},
    listeners: {},
    innerHTML: "",
    setAttribute() {},
    removeAttribute() {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    querySelector(selector) { return elements.get(selector) || null; },
  });
  const app = element();
  const retry = element();
  elements.set("[data-growth-retry]", retry);
  const identity = { userId: "student-a", schoolId: "school-a" };
  const current = {
    profile: { userId: "student-a", displayName: "测试学生甲", schoolName: "测试学校甲", gradeBand: "七年级", className: "甲班" },
    history: { enrollmentId: "enrollment-a", sessions: [] },
    events: { enrollmentId: "enrollment-a", events: [] },
    progress: emptyProgress(),
    sessions: { items: [], nextCursor: null },
    practices: { items: [] },
    reports: new Map(),
  };
  const windowListeners = {};
  const api = {
    getToken: () => "unit-token",
    getStoredUser: () => ({ id: identity.userId }),
    getActiveSchoolId: () => identity.schoolId,
    getStudentProfile: async () => ({ profile: current.profile }),
    getAssessmentHistory: async () => current.history,
    getAssessmentHistoryEvents: async () => current.events,
    getQuestionBankProgress: async () => current.progress,
    listAssessmentSessions: async () => current.sessions,
    listPractices: async () => current.practices,
    getPracticeAttempt: async (id) => { throw Object.assign(new Error("not a practice attempt"), { status: 404, id }); },
    getAssessmentSession: async (id) => ({ id, status: "IN_PROGRESS", purpose: "STANDARD", updatedAt: "2026-10-11T09:30:00.000Z" }),
    listAssessmentItems: async () => ({ items: [{ status: "ANSWERED" }, { status: "PENDING" }] }),
    getPracticeAttemptItems: async () => ({ items: [{ status: "ANSWERED" }, { status: "PENDING" }] }),
    getAssessmentReport: async (id) => current.reports.get(id) ?? null,
    ...overrides,
  };
  const context = {
    document: { querySelector: () => app },
    YuzanApi: api,
    window: { addEventListener(name, callback) { windowListeners[name] = callback; } },
    location: {},
    Date,
    Intl,
    Object,
    console,
  };
  vm.runInNewContext(source, context);
  return { app, retry, identity, current, context, windowListeners };
}

test("empty growth state contains no invented score or chart", async () => {
  const view = mount();
  await flush();
  assert.equal(view.app.dataset.state, "empty");
  assert.match(view.app.innerHTML, /测试学生甲的成长记录/);
  assert.match(view.app.innerHTML, /测试学校甲 · 七年级 · 甲班/);
  assert.match(view.app.innerHTML, /还没有正式测评时间序列/);
  assert.match(view.app.innerHTML, /没有已发布的教师反馈/);
  assert.doesNotMatch(view.app.innerHTML, /role="img"|0 分|100%|连续学习天/);
});

test("formal chart appears only with three real dated scores and a generated report", async () => {
  const view = mount();
  const levelId = "definition-a";
  const attempts = [
    { sessionId: "formal-1", overallScore: 7, practiceVersionId: "version-a", completedAt: "2026-08-01T00:00:00.000Z" },
    { sessionId: "formal-2", overallScore: 9, practiceVersionId: "version-a", completedAt: "2026-09-01T00:00:00.000Z" },
    { sessionId: "formal-3", overallScore: 10, practiceVersionId: "version-b", completedAt: "2026-10-01T00:00:00.000Z" },
  ];
  view.current.history.sessions = attempts.map((item) => ({
    sessionId: item.sessionId,
    type: "MIXED",
    purpose: "STANDARD",
    completedAt: item.completedAt,
    metrics: { overall: item.overallScore },
    remediation: null,
  }));
  Object.assign(view.current.progress, {
    version: "qb-progress-v1",
    state: "READY",
    formalLevels: [{
      level: "水平一级",
      practiceDefinitionId: levelId,
      practiceVersionId: "version-b",
      attemptCount: 3,
      latestCompletedAt: attempts.at(-1).completedAt,
      practiceVersionChanged: true,
      attempts,
    }],
    remediation: [],
    milestones: [],
    latest: { level: "水平一级", formal: { sessionId: "formal-3", overallScore: 10, completedAt: attempts.at(-1).completedAt, comparisonState: "COMPARABLE", latestVsPrevious: 1 }, remediation: null },
  });
  for (const item of attempts) {
    view.current.reports.set(item.sessionId, {
      sessionId: item.sessionId,
      overallScore: item.overallScore,
      dataCompleteness: 100,
      generatedAt: item.completedAt,
      diagnosis: { retryCandidates: item.sessionId === "formal-3" ? [{ displayName: "句子理解" }] : [] },
    });
  }
  await flush();
  assert.match(view.app.innerHTML, /role="img"/);
  assert.match(view.app.innerHTML, /7.*9.*10/s);
  assert.match(view.app.innerHTML, /练习版本发生过变化/);
  assert.match(view.app.innerHTML, /句子理解/);
  assert.match(view.app.innerHTML, /assessment\/sessions\/formal-3\/report/);
});

test("completed record without a report is labeled and never given a score", async () => {
  const view = mount();
  view.current.history.sessions = [{
    sessionId: "completed-no-report",
    type: "MIXED",
    purpose: "STANDARD",
    completedAt: "2026-10-01T00:00:00.000Z",
    metrics: null,
    remediation: null,
  }];
  await flush();
  assert.match(view.app.innerHTML, /尚未生成正式报告/);
  assert.doesNotMatch(view.app.innerHTML, /completed-no-report.*0 分|0 分.*completed-no-report/);
  assert.doesNotMatch(view.app.innerHTML, /最近正式成绩 0/);
});

test("a report awaiting teacher review never exposes its provisional score", async () => {
  const view = mount();
  view.current.history.sessions = [{
    sessionId: "speech-needs-review",
    type: "READING",
    purpose: "STANDARD",
    completedAt: "2026-10-01T00:00:00.000Z",
    metrics: { overall: 88 },
    remediation: null,
  }];
  view.current.reports.set("speech-needs-review", {
    sessionId: "speech-needs-review",
    overallScore: 88,
    dataCompleteness: 100,
    generatedAt: "2026-10-01T00:00:00.000Z",
    summary: { requiresTeacherReview: true, scoringState: "NEEDS_REVIEW" },
  });
  await flush();
  assert.match(view.app.innerHTML, /报告正在等待教师复核/);
  assert.match(view.app.innerHTML, /未审核的语音题不会显示正式成绩/);
  assert.doesNotMatch(view.app.innerHTML, /88 分|speech-needs-review/);
});

test("active Attempt shows saved item progress and a dynamic continuation link", async () => {
  const view = mount();
  view.current.sessions.items = [
    { id: "attempt-a", status: "IN_PROGRESS", purpose: "STANDARD", createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-11T09:30:00.000Z" },
  ];
  view.current.practices.items = [{ id: "definition-a", title: "本人开放练习", summary: "真实练习摘要", mode: "SELF_PRACTICE", catalogType: "SPECIALIZED", studentState: { completionStatus: "IN_PROGRESS" } }];
  view.current.history.sessions = [];
  await flush();
  assert.match(view.app.innerHTML, /已完成 1 \/ 2 道/);
  assert.match(view.app.innerHTML, /本人开放练习/);
  assert.match(view.app.innerHTML, /assessment\/sessions\/attempt-a/);
  assert.match(view.app.innerHTML, /继续练习/);
});

test("feedback and identity switch use current server identity and records", async () => {
  const view = mount();
  view.current.events.events = [{ id: "feedback-a", type: "FEEDBACK", title: "老师建议", description: "请继续练习句子理解。", timestamp: "2026-10-12T09:00:00.000Z" }];
  await flush();
  assert.match(view.app.innerHTML, /请继续练习句子理解/);
  view.identity.userId = "student-b";
  view.identity.schoolId = "school-b";
  view.current.profile = { userId: "student-b", displayName: "测试学生乙", schoolName: "测试学校乙", gradeBand: "八年级", className: "乙班" };
  view.current.history = { enrollmentId: "enrollment-b", sessions: [] };
  view.current.events = { enrollmentId: "enrollment-b", events: [] };
  view.current.progress = emptyProgress();
  view.current.sessions = { items: [], nextCursor: null };
  view.current.practices = { items: [] };
  view.windowListeners.storage({ key: "yuzan-active-school-id" });
  await flush();
  assert.match(view.app.innerHTML, /测试学生乙的成长记录/);
  assert.match(view.app.innerHTML, /测试学校乙 · 八年级 · 乙班/);
  assert.doesNotMatch(view.app.innerHTML, /测试学生甲|测试学校甲|请继续练习句子理解|feedback-a/);
});

test("permission and network errors replace the page with a retry state", async (t) => {
  for (const status of [401, 403, 404, 409, 0]) {
    await t.test(status ? `HTTP ${status}` : "network disconnected", async () => {
      const error = status ? Object.assign(new Error("request failed"), { status }) : new TypeError("offline");
      const view = mount({ getQuestionBankProgress: async () => { throw error; } });
      await flush();
      assert.equal(view.app.dataset.state, "error");
      assert.match(view.app.innerHTML, /重新读取/);
      assert.doesNotMatch(view.app.innerHTML, /测试学生甲的成长记录/);
    });
  }
});
