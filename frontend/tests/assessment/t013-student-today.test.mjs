import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(
  new URL("../../student/today/today.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function mount(overrides = {}) {
  const elements = new Map();
  const element = () => ({
    dataset: {},
    listeners: {},
    disabled: false,
    innerHTML: "",
    textContent: "",
    setAttribute() {},
    removeAttribute() {},
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
    after(node) {
      elements.set("[data-primary-error]", node);
    },
    append() {},
    remove() {
      elements.delete("[data-primary-error]");
    },
    querySelector(selector) {
      return elements.get(selector) || null;
    },
  });
  const app = element();
  const wrap = element();
  const controls = new Map();
  for (const selector of [
    "[data-primary-action]",
    "[data-today-retry]",
    "[data-courses-retry]",
    "[data-practices-retry]",
    "[data-attempts-retry]",
  ]) {
    const control = element();
    control.tagName = selector === "[data-primary-action]" ? "BUTTON" : "BUTTON";
    controls.set(selector, control);
  }
  elements.set(".today-course-wrap", wrap);
  for (const [selector, control] of controls) elements.set(selector, control);
  const identity = { userId: "student-a", schoolId: "school-a" };
  const current = {
    profile: { userId: "student-a", displayName: "测试学生甲", schoolName: "测试学校甲", gradeBand: "七年级", className: "甲班" },
    today: {
      version: "student-today-v1",
      primaryAction: null,
      secondaryActions: [],
      waiting: [],
      legacyTasks: [],
      summary: { latestFormalAssessment: null },
    },
    courses: { courses: [] },
    practices: { items: [] },
    sessions: { items: [] },
  };
  const windowListeners = {};
  const api = {
    getToken: () => "unit-token",
    getStoredUser: () => ({ id: identity.userId }),
    getActiveSchoolId: () => identity.schoolId,
    getStudentProfile: async () => ({ profile: current.profile }),
    getStudentToday: async () => current.today,
    listStudentCourses: async () => current.courses,
    listPractices: async () => current.practices,
    listAssessmentSessions: async () => current.sessions,
    getPracticeAttempt: async (id) => ({ id, practiceDefinitionId: "definition-a", status: "IN_PROGRESS" }),
    getPracticeAttemptItems: async () => ({ items: [{ status: "ANSWERED" }, { status: "PENDING" }] }),
    ...overrides,
  };
  const context = {
    document: { querySelector: () => app, createElement: element },
    YuzanApi: api,
    location: {},
    window: {
      addEventListener(name, callback) {
        windowListeners[name] = callback;
      },
    },
    Date,
    Intl,
    URL,
    console,
  };
  vm.runInNewContext(source, context);
  return { app, wrap, controls, context, identity, current, windowListeners };
}

test("Today uses the server primary action, real school identity, and dynamic Attempt", async () => {
  const view = mount();
  view.current.today.primaryAction = {
    kind: "TEACHER_REMEDIATION",
    title: "老师布置的阅读专项巩固",
    reason: "老师安排了这项练习。",
    cta: "继续巩固",
    target: { href: "/student/practices/attempts/attempt-a/runner/" },
  };
  view.current.sessions.items = [
    { id: "attempt-a", status: "IN_PROGRESS", purpose: "REMEDIATION", createdAt: "2026-10-10T01:00:00.000Z", updatedAt: "2026-10-10T01:00:00.000Z" },
  ];
  view.current.practices.items = [
    { id: "definition-a", title: "阅读巩固", mode: "ASSIGNMENT", catalogType: "SPECIALIZED", studentState: { completionStatus: "IN_PROGRESS" } },
  ];
  await flush();
  assert.match(view.app.innerHTML, /测试学生甲/);
  assert.match(view.app.innerHTML, /测试学校甲 · 七年级 · 甲班/);
  assert.match(view.app.innerHTML, /老师布置的阅读专项巩固/);
  assert.match(view.app.innerHTML, /attempt-a/);
  assert.match(view.app.innerHTML, /继续巩固/);
  assert.match(view.app.innerHTML, /已完成 1 \/ 2 道/);
  assert.doesNotMatch(view.app.innerHTML, /连续学习天|100%|student\.test|cover-spring/);
});

test("processing Attempt has a real status destination and does not invent a score", async () => {
  const view = mount();
  view.current.today.waiting = [{ kind: "TEACHER_REVIEW", title: "待复核", reason: "等待处理", itemCount: 2 }];
  view.current.sessions.items = [
    { id: "processing-a", status: "PROCESSING", purpose: "STANDARD", createdAt: "2026-10-10T01:00:00.000Z", updatedAt: "2026-10-10T02:00:00.000Z" },
  ];
  await flush();
  assert.match(view.app.innerHTML, /正在处理的记录/);
  assert.match(view.app.innerHTML, /processing-a/);
  assert.match(view.app.innerHTML, /查看处理状态/);
  assert.match(view.app.innerHTML, /assessment\/sessions\/processing-a\/processing/);
  assert.doesNotMatch(view.app.innerHTML, /0 分|100 分|100%/);
});

test("Today reads all authorized Attempt pages before showing an empty state", async () => {
  const cursors = [];
  const view = mount({
    listAssessmentSessions: async ({ cursor }) => {
      cursors.push(cursor || "first");
      return cursor
        ? { items: [{ id: "processing-page-two", status: "PROCESSING", purpose: "STANDARD", updatedAt: "2026-10-10T00:00:00.000Z" }], nextCursor: null, hasMore: false }
        : { items: [{ id: "older-active", status: "COMPLETED", purpose: "STANDARD" }], nextCursor: "next-page", hasMore: true };
    },
  });
  await flush();
  assert.deepEqual(cursors, ["first", "next-page"]);
  assert.equal(view.app.dataset.state, "processing");
  assert.match(view.app.innerHTML, /processing-page-two/);
  assert.match(view.app.innerHTML, /查看处理状态/);
  assert.match(view.app.innerHTML, /assessment\/sessions\/processing-page-two\/processing/);
});

test("empty Today is explicit when all current endpoints return no tasks", async () => {
  const view = mount();
  await flush();
  assert.equal(view.app.dataset.state, "empty");
  assert.match(view.app.innerHTML, /今天暂时没有待开始的练习/);
  assert.match(view.app.innerHTML, /当前没有已开放的练习/);
  assert.match(view.wrap.innerHTML, /data-course-state="empty"/);
  assert.doesNotMatch(view.app.innerHTML, /演示任务|student\.test|42%|连续学习天/);
});

test("Today does not report no tasks when supplemental task sources failed", async () => {
  const view = mount({ listPractices: async () => { throw new TypeError("offline"); } });
  await flush();
  assert.equal(view.app.dataset.state, "partial");
  assert.match(view.app.innerHTML, /学习安排尚未完全确认/);
  assert.match(view.app.innerHTML, /重新读取学习安排/);
  assert.match(view.app.innerHTML, /开放练习暂时无法确认/);
  assert.doesNotMatch(view.app.innerHTML, /今天暂时没有待开始的练习/);
});

test("401, 403, and 404 from Today are visible and never retain the previous student", async (t) => {
  for (const status of [401, 403, 404]) {
    await t.test(`HTTP ${status}`, async () => {
      const error = Object.assign(new Error("service error"), { status });
      const view = mount({ getStudentToday: async () => { throw error; } });
      await flush();
      assert.equal(view.app.dataset.state, "error");
      assert.match(view.app.innerHTML, status === 401 ? /重新登录/ : status === 403 ? /没有访问权限/ : /已不可用/);
      assert.doesNotMatch(view.app.innerHTML, /测试学生甲/);
      assert.equal(view.context.window.__studentTodayData, undefined);
    });
  }
});

test("switching the stored account and school rereads and replaces Today data", async () => {
  const view = mount();
  await flush();
  assert.match(view.app.innerHTML, /测试学生甲/);
  view.identity.userId = "student-b";
  view.identity.schoolId = "school-b";
  view.current.profile = { userId: "student-b", displayName: "测试学生乙", schoolName: "测试学校乙", gradeBand: "八年级", className: "乙班" };
  view.current.today = {
    version: "student-today-v1",
    primaryAction: null,
    secondaryActions: [],
    waiting: [],
    legacyTasks: [],
    summary: { latestFormalAssessment: null },
  };
  view.windowListeners.storage({ key: "yuzan-current-user" });
  await flush();
  assert.match(view.app.innerHTML, /测试学生乙/);
  assert.match(view.app.innerHTML, /测试学校乙 · 八年级 · 乙班/);
  assert.doesNotMatch(view.app.innerHTML, /测试学生甲|测试学校甲|attempt-a/);
});
