import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(
  new URL("../../assessment/assets/app.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

function mount(api, storageData = new Map()) {
  const nodes = new Map();
  const root = {
    html: "",
    get innerHTML() {
      return this.html;
    },
    set innerHTML(value) {
      this.html = value;
      for (const selector of [
        "[data-retry]",
        "[data-history-more]",
        "[data-history-events-retry]",
        "[data-history-query]",
        "[data-history-status]",
        "[data-history-reset]",
        "[data-history-query-retry]",
      ]) {
        if (!this.html.includes(selector.slice(1, -1))) continue;
        if (!nodes.has(selector)) nodes.set(selector, {
          value: "",
          disabled: false,
          listeners: {},
          addEventListener(type, handler) { this.listeners[type] = handler; },
          setAttribute() {},
          focus() {},
        });
      }
    },
  };
  const context = vm.createContext({
    YuzanApi: api,
    URLSearchParams,
    console: { error() {}, warn() {}, log() {} },
    setTimeout,
    clearTimeout,
    location: { pathname: "/student/practices/history/", search: "" },
    localStorage: {
      getItem: (key) => storageData.get(key) ?? null,
      setItem: (key, value) => storageData.set(key, value),
      removeItem: (key) => storageData.delete(key),
    },
    document: {
      body: { dataset: { page: "history" } },
      getElementById: (id) => (id === "app" ? root : null),
      querySelector: (selector) => nodes.get(selector) || null,
      querySelectorAll: () => [],
    },
    window: { YuzanApi: api, addEventListener() {}, setTimeout, clearTimeout },
  });
  vm.runInContext(source, context, { filename: "frontend/assessment/assets/app.js" });
  return { root, context, nodes, storageData };
}

test("history clears cached prior-student data and combines real in-progress sessions, reports, and feedback by the server-selected enrollment", async () => {
  const storageData = new Map([
    [
      "yuzan-assessment-v5-nosession",
      JSON.stringify({
        apiHistory: { sessions: [{ sessionId: "attempt-b-secret", metrics: { overall: 99 } }] },
        apiSessionPage: { items: [{ id: "attempt-b-secret" }] },
        apiHistoryEvents: { events: [{ description: "student-b-private-feedback" }] },
      }),
    ],
  ]);
  const calls = [];
  const api = {
    getToken: () => "student-a-token",
    listAssessmentSessions: async (options) => {
      calls.push(["sessions", options]);
      return {
        items: [
          { id: "attempt-a-processing", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "MIXED", status: "PROCESSING", createdAt: "2026-10-18T01:00:00.000Z", updatedAt: "2026-10-18T01:02:00.000Z" },
          { id: "attempt-a-completed", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "MIXED", status: "COMPLETED", createdAt: "2026-10-17T01:00:00.000Z", updatedAt: "2026-10-17T01:01:00.000Z" },
        ],
        nextCursor: null,
        hasMore: false,
      };
    },
    getAssessmentHistory: async (options) => {
      calls.push(["history", options]);
      return {
        enrollmentId: "enrollment-a",
        sessions: [{ sessionId: "attempt-a-completed", purpose: "STANDARD", type: "MIXED", completedAt: "2026-10-17T01:00:00.000Z", metrics: { overall: 84 }, remediation: null }],
      };
    },
    getAssessmentHistoryEvents: async (enrollmentId) => {
      calls.push(["events", enrollmentId]);
      return { events: [{ id: "feedback-a", type: "FEEDBACK", title: "需要改进", description: "student-a-feedback", timestamp: "2026-10-17T02:00:00.000Z" }] };
    },
    getPracticeAttempt: async () => { throw Object.assign(new Error("legacy assessment session"), { status: 404 }); },
    getAssessmentReport: async (sessionId) => ({ id: `report-${sessionId}`, sessionId, dataCompleteness: 100, overallScore: 84, teacherFeedback: [{ comment: "正式测评复核评语", reviewedAt: "2026-10-17T03:00:00.000Z" }] }),
  };

  const view = mount(api, storageData);
  assert.doesNotMatch(view.root.innerHTML, /attempt-b-secret|student-b-private-feedback|99/);
  await flush();

  assert.equal(calls[0][0], "sessions");
  assert.equal(calls[0][1].limit, 25);
  assert.equal(calls[1][0], "history");
  assert.equal(calls[1][1].enrollmentId, "enrollment-a");
  assert.equal(calls[1][1].range, "all");
  assert.deepEqual(calls.find((call) => call[0] === "events"), ["events", "enrollment-a"]);
  assert.match(view.root.innerHTML, /attempt-a-processing/);
  assert.match(view.root.innerHTML, /处理中/);
  assert.match(view.root.innerHTML, /查看处理状态/);
  assert.match(view.root.innerHTML, /\/assessment\/sessions\/attempt-a-processing\/processing\//);
  assert.match(view.root.innerHTML, /正式报告 84 分/);
  assert.match(view.root.innerHTML, /正式测评复核评语 · AssessmentReview/);
  assert.match(view.root.innerHTML, /课程任务教师反馈 · Feedback/);
  assert.ok(view.root.innerHTML.indexOf("正式测评复核评语 · AssessmentReview") < view.root.innerHTML.indexOf("课程任务反馈 · Feedback"));
  assert.match(view.root.innerHTML, /课程 Submission 的已发布 Feedback；与正式测评的 AssessmentReview 评语分开显示/);
  assert.match(view.root.innerHTML, /student-a-feedback/);
  assert.doesNotMatch(view.root.innerHTML, /attempt-b-secret|student-b-private-feedback|99/);

  const saved = JSON.parse(storageData.get("yuzan-assessment-v5-nosession"));
  assert.equal("apiHistory" in saved, false);
  assert.equal("apiSessionPage" in saved, false);
  assert.equal("apiHistoryReports" in saved, false);
  assert.equal("apiPracticeRoutes" in saved, false);
  assert.equal("apiHistoryEvents" in saved, false);
});

test("history load failure is visible and its retry reloads the current student's records", async () => {
  let sessionReads = 0;
  const api = {
    getToken: () => "student-a-token",
    listAssessmentSessions: async () => {
      sessionReads += 1;
      if (sessionReads === 1) throw Object.assign(new Error("没有访问权限"), { status: 403 });
      return { items: [], nextCursor: null, hasMore: false };
    },
    getAssessmentHistory: async () => ({ enrollmentId: "enrollment-a", sessions: [] }),
    getAssessmentHistoryEvents: async () => ({ events: [] }),
  };
  const view = mount(api);
  await flush();
  assert.match(view.root.innerHTML, /加载历史失败/);
  assert.match(view.root.innerHTML, /没有访问权限/);
  const retry = view.nodes.get("[data-retry]");
  assert.equal(typeof retry?.listeners.click, "function");
  await retry.listeners.click();
  await flush();
  assert.equal(sessionReads, 2);
  assert.match(view.root.innerHTML, /还没有练习记录/);
  assert.doesNotMatch(view.root.innerHTML, /加载历史失败/);
});

test("formal zero, missing, and incomplete reports stay distinct and only a complete authorized report is linked", async () => {
  const sessions = [
    { id: "attempt-zero", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "MIXED", status: "COMPLETED", createdAt: "2026-10-18T01:00:00.000Z" },
    { id: "attempt-missing", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "READING", status: "COMPLETED", createdAt: "2026-10-17T01:00:00.000Z" },
    { id: "attempt-incomplete", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "WRITTEN", status: "COMPLETED", createdAt: "2026-10-16T01:00:00.000Z" },
  ];
  const api = {
    getToken: () => "student-a-token",
    listAssessmentSessions: async () => ({ items: sessions, nextCursor: null, hasMore: false }),
    getAssessmentHistory: async () => ({ enrollmentId: "enrollment-a", sessions: [] }),
    getAssessmentHistoryEvents: async () => ({ events: [] }),
    getPracticeAttempt: async () => { throw Object.assign(new Error("not a practice attempt"), { status: 404 }); },
    getAssessmentReport: async (sessionId) => {
      if (sessionId === "attempt-missing") return null;
      return {
        id: `report-${sessionId}`,
        sessionId,
        dataCompleteness: sessionId === "attempt-zero" ? 100 : 99,
        overallScore: sessionId === "attempt-zero" ? 0 : 88,
        teacherFeedback: [],
      };
    },
  };
  const view = mount(api);
  await flush();
  const html = view.root.innerHTML;
  assert.match(html, /attempt-zero[\s\S]*?正式报告 0 分/);
  assert.match(html, /attempt-missing[\s\S]*?正式报告尚未生成；没有展示成绩/);
  assert.match(html, /attempt-incomplete[\s\S]*?正式报告尚未完整；没有展示成绩/);
  assert.match(html, /href="\/assessment\/sessions\/attempt-zero\/report\/"/);
  assert.doesNotMatch(html, /href="\/assessment\/sessions\/attempt-missing\/report\/"/);
  assert.doesNotMatch(html, /href="\/assessment\/sessions\/attempt-incomplete\/report\/"/);
});

test("status changes use exact server filters and cursor paging loads the next real page", async () => {
  const calls = [];
  const api = {
    getToken: () => "student-a-token",
    listAssessmentSessions: async (options = {}) => {
      calls.push(options);
      if (options.status === "PROCESSING") {
        return { items: [{ id: "processing-a", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "MIXED", status: "PROCESSING" }], nextCursor: null, hasMore: false };
      }
      if (options.cursor === "cursor-a") {
        return { items: [{ id: "in-progress-b", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "READING", status: "IN_PROGRESS" }], nextCursor: null, hasMore: false };
      }
      return { items: [{ id: "in-progress-a", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "READING", status: "IN_PROGRESS" }], nextCursor: "cursor-a", hasMore: true };
    },
    getAssessmentHistory: async () => ({ enrollmentId: "enrollment-a", sessions: [] }),
    getAssessmentHistoryEvents: async () => ({ events: [] }),
    getPracticeAttempt: async (id) => ({ id, practiceDefinitionId: `definition-${id}` }),
    getPractice: async (definitionId) => ({ id: definitionId, title: definitionId.includes("search-match") ? "T036 cursor sample 27" : "A different real exercise" }),
    getAssessmentReport: async () => null,
  };
  const view = mount(api);
  await flush();
  const status = view.nodes.get("[data-history-status]");
  status.value = "PROCESSING";
  await status.listeners.change();
  await flush();
  assert.ok(calls.some((options) => options.status === "PROCESSING"));
  assert.match(view.root.innerHTML, /processing-a/);
  assert.doesNotMatch(view.root.innerHTML, /data-history-session="in-progress-a"/);

  status.value = "";
  await status.listeners.change();
  await flush();
  const more = view.nodes.get("[data-history-more]");
  assert.equal(typeof more?.listeners.click, "function");
  await more.listeners.click();
  await flush();
  assert.ok(calls.some((options) => options.cursor === "cursor-a" && options.limit === 25));
  assert.match(view.root.innerHTML, /in-progress-a/);
  assert.match(view.root.innerHTML, /in-progress-b/);
});

test("name search scans cursor pages and discards a slower stale status response", async () => {
  let resolveSlowStatus;
  const calls = [];
  const api = {
    getToken: () => "student-a-token",
    listAssessmentSessions: async (options = {}) => {
      calls.push(options);
      if (options.status === "IN_PROGRESS") {
        return new Promise((resolve) => { resolveSlowStatus = resolve; });
      }
      if (options.status === "PROCESSING") {
        return { items: [{ id: "processing-current", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "MIXED", status: "PROCESSING" }], nextCursor: null, hasMore: false };
      }
      if (options.limit === 100 && options.cursor === "cursor-search") {
        return { items: [{ id: "search-match", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "READING", status: "IN_PROGRESS" }], nextCursor: null, hasMore: false };
      }
      return { items: [{ id: "search-other", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "WRITTEN", status: "IN_PROGRESS" }], nextCursor: "cursor-search", hasMore: true };
    },
    getAssessmentHistory: async () => ({ enrollmentId: "enrollment-a", sessions: [] }),
    getAssessmentHistoryEvents: async () => ({ events: [] }),
    getPracticeAttempt: async (id) => ({ id, practiceDefinitionId: `definition-${id}` }),
    getPractice: async (definitionId) => ({ id: definitionId, title: definitionId.includes("search-match") ? "T036 cursor sample 27" : "A different real exercise" }),
    getAssessmentReport: async () => null,
  };
  const view = mount(api);
  await flush();

  const status = view.nodes.get("[data-history-status]");
  status.value = "IN_PROGRESS";
  status.listeners.change();
  await flush();
  assert.equal(typeof resolveSlowStatus, "function");
  status.value = "PROCESSING";
  status.listeners.change();
  await flush();
  assert.match(view.root.innerHTML, /processing-current/);
  resolveSlowStatus({ items: [{ id: "stale-in-progress", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "READING", status: "IN_PROGRESS" }], nextCursor: null, hasMore: false });
  await flush();
  assert.doesNotMatch(view.root.innerHTML, /stale-in-progress/);

  const query = view.nodes.get("[data-history-query]");
  status.value = "";
  status.listeners.change();
  await flush();
  query.value = "cursor sample 27";
  query.listeners.input();
  await new Promise((resolve) => setTimeout(resolve, 320));
  await flush();
  assert.ok(calls.some((options) => options.limit === 100 && !options.cursor));
  assert.ok(calls.some((options) => options.cursor === "cursor-search"));
  assert.match(view.root.innerHTML, /search-match/);
  assert.match(view.root.innerHTML, /T036 cursor sample 27/);
  assert.doesNotMatch(view.root.innerHTML, /search-other/);
});
