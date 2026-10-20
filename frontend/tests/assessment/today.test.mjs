import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(
  new URL("../../student/today/today.js", import.meta.url),
  "utf8",
);
const decision = {
  version: "student-today-v1",
  primaryAction: null,
  waiting: [],
  legacyTasks: [],
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function mount(api = {}) {
  const elements = new Map();
  const windowListeners = new Map();
  const element = () => ({
    dataset: {},
    listeners: {},
    innerHTML: "",
    textContent: "",
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    },
    setAttribute() {},
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
  elements.set(".today-course-wrap", wrap);
  for (const selector of [
    "[data-primary-action]",
    "[data-today-retry]",
    "[data-courses-retry]",
  ])
    elements.set(selector, element());
  const context = {
    document: { querySelector: () => app, createElement: element },
    YuzanApi: {
      getToken: () => "unit-token",
      getActiveSchoolId: () => "unit-school",
      getStudentToday: async () => decision,
      listStudentCourses: async () => ({ courses: [] }),
      listPractices: async () => ({ items: [] }),
      listAssessmentSessions: async () => ({ items: [], nextCursor: null, hasMore: false }),
      ...api,
    },
    location: {},
    window: {
      addEventListener(name, fn) {
        windowListeners.set(name, fn);
      },
    },
    Date,
    URL,
    console,
  };
  vm.runInNewContext(source, context);
  return { app, wrap, context, elements, windowListeners };
}

test("loading → empty and processing remain distinct from errors", async () => {
  let resolve;
  const view = mount({
    getStudentToday: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  assert.equal(view.app.dataset.state, "loading");
  resolve(decision);
  await flush();
  assert.equal(view.app.dataset.state, "empty");
  assert.match(view.wrap.innerHTML, /data-course-state="empty"/);
  const processing = mount({
    getStudentToday: async () => ({
      ...decision,
      waiting: [{ title: "人工复核", reason: "处理中" }],
    }),
  });
  await flush();
  assert.equal(processing.app.dataset.state, "processing");
  assert.match(processing.app.innerHTML, /等待老师复核/);
});

test("403 is a visible error; retry recovers with newly fetched data", async () => {
  let fail = true;
  const view = mount({
    getStudentToday: async () => {
      if (fail) throw Object.assign(new Error("denied"), { status: 403 });
      return decision;
    },
  });
  await flush();
  assert.equal(view.app.dataset.state, "error");
  assert.match(view.app.innerHTML, /没有访问权限/);
  assert.equal(view.context.window.__studentTodayData, undefined);
  fail = false;
  await view.elements.get("[data-today-retry]").listeners.click();
  assert.equal(view.app.dataset.state, "empty");
});

test("catalog failure and malformed response never masquerade as empty; retry only catalog", async () => {
  let reads = 0;
  let catalogReads = 0;
  const view = mount({
    getStudentToday: async () => {
      reads++;
      return decision;
    },
    listStudentCourses: async () =>
      ++catalogReads === 1 ? {} : { courses: [] },
  });
  await flush();
  assert.match(view.wrap.innerHTML, /data-course-state="error"/);
  assert.match(view.wrap.innerHTML, /暂时无法确认可学课程/);
  await view.elements.get("[data-courses-retry]").listeners.click();
  assert.match(view.wrap.innerHTML, /data-course-state="empty"/);
  assert.equal(reads, 1);
});

test("primary creation failure preserves page and retries the real action", async () => {
  let tries = 0;
  const view = mount({
    getStudentToday: async () => ({
      ...decision,
      primaryAction: {
        kind: "BASELINE",
        title: "首次测评",
        cta: "开始",
        target: { practiceDefinitionId: "dynamic-definition" },
      },
    }),
    createOrResumePractice: async (id) => {
      assert.equal(id, "dynamic-definition");
      if (++tries === 1) throw new TypeError("Network offline");
      return { attemptId: "dynamic-attempt" };
    },
  });
  await flush();
  const button = view.elements.get("[data-primary-action]");
  await button.listeners.click();
  assert.equal(button.disabled, false);
  assert.equal(view.app.dataset.state, "ready");
  assert.match(
    view.elements.get("[data-primary-error]").textContent,
    /网络连接失败/,
  );
  assert.equal(view.context.location.href, undefined);
  await button.listeners.click();
  assert.equal(
    view.context.location.href,
    "/student/practices/attempts/dynamic-attempt/runner/",
  );
});

test("a same-school BFCache return reloads the authoritative Today action", async () => {
  let reads = 0;
  const view = mount({
    getStudentToday: async () => {
      reads += 1;
      return reads === 1
        ? decision
        : {
            ...decision,
            primaryAction: {
              kind: "BASELINE",
              title: "返回后出现的已授权任务",
              cta: "开始",
              target: { practiceDefinitionId: "returned-definition" },
            },
          };
    },
  });
  await flush();
  assert.equal(reads, 1);

  view.windowListeners.get("pageshow")({ persisted: true });
  await flush();

  assert.equal(reads, 2);
  assert.match(view.app.innerHTML, /返回后出现的已授权任务/);
});

test("a successful create response cannot navigate after the active school changes", async () => {
  let activeSchool = "school-a";
  let resolveCreate;
  let todayReads = 0;
  const view = mount({
    getActiveSchoolId: () => activeSchool,
    getStudentToday: async () => {
      todayReads += 1;
      return {
        ...decision,
        primaryAction: {
          kind: "BASELINE",
          title: "当前学校的首次测评",
          cta: "开始",
          target: { practiceDefinitionId: "school-a-definition" },
        },
      };
    },
    createOrResumePractice: () =>
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
  });
  await flush();
  const button = view.elements.get("[data-primary-action]");
  const click = button.listeners.click({ currentTarget: button });
  await flush();
  activeSchool = "school-b";
  resolveCreate({ attemptId: "school-a-attempt" });
  await click;
  await flush();

  assert.equal(view.context.location.href, undefined);
  assert.equal(todayReads, 2);
  assert.match(view.app.innerHTML, /当前学校的首次测评/);
});

test("legacy redirect preserves dynamic assignment and activity IDs", () => {
  const html = readFileSync(
    new URL("../../student/learn/spring-2/index.html", import.meta.url),
    "utf8",
  );
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const key of ["assignmentId", "id"]) {
    let target;
    const assignment = crypto.randomUUID();
    const activity = crypto.randomUUID();
    vm.runInNewContext(script, {
      URLSearchParams,
      window: {
        location: {
          search: `?${key}=${assignment}&activityId=${activity}`,
          replace(value) {
            target = value;
          },
        },
      },
    });
    assert.equal(
      target,
      `/student/courses/course-detail/?id=${assignment}&activityId=${activity}`,
    );
  }
});
