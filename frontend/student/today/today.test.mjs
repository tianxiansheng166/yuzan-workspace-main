import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./today.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount({ courseResponse, courseError, todayData, displayName } = {}) {
  let html = "";
  let ariaBusy = "true";
  const listeners = new Map();
  const app = {
    dataset: {},
    set innerHTML(value) {
      html = value;
    },
    get innerHTML() {
      return html;
    },
    removeAttribute(name) {
      if (name === "aria-busy") ariaBusy = null;
    },
    setAttribute(name, value) {
      if (name === "aria-busy") ariaBusy = String(value);
    },
    getAttribute(name) {
      return name === "aria-busy" ? ariaBusy : null;
    },
    querySelector(selector) {
      if (
        !html.includes(
          selector.includes("course-retry")
            ? "data-course-retry"
            : selector.slice(1, -1),
        )
      )
        return null;
      return {
        addEventListener(name, callback) {
          listeners.set(`${selector}:${name}`, callback);
        },
        disabled: false,
        textContent: "",
      };
    },
  };
  const calls = [];
  const api = {
    getToken: () => "TEST_FIXTURE_ONLY",
    getActiveSchoolId: () => "school-fixture",
    getStudentToday: async () => todayData || {
      version: "student-today-v1",
      primaryAction: null,
      waiting: [],
      secondaryActions: [],
      legacyTasks: [],
      summary: {},
    },
    getStudentProfile: async () => ({
      profile: { userId: "student-fixture", identityUnavailable: false, displayName },
    }),
    listStudentCourses: async (options) => {
      calls.push(options);
      if (courseError) throw courseError;
      return courseResponse || { courses: [] };
    },
    listPractices: async () => ({ items: [] }),
    listAssessmentSessions: async () => ({ items: [], nextCursor: null, hasMore: false }),
  };
  const location = { href: "" };
  vm.runInNewContext(source, {
    document: {
      querySelector: (selector) => (selector === "#todayApp" ? app : null),
    },
    window: { addEventListener() {} },
    YuzanApi: api,
    location,
    Date,
    String,
    Number,
    Math,
    Promise,
    encodeURIComponent,
  });
  return { app, calls, listeners, location };
}

test("Today keeps the main page available and distinguishes a course API error from an empty catalog", async () => {
  const f = mount({ courseError: new Error("fixture outage") });
  await tick();

  assert.match(f.app.innerHTML, /今天好/);
  assert.match(f.app.innerHTML, /课程列表加载失败/);
  assert.equal(f.app.getAttribute("aria-busy"), null);
  assert.doesNotMatch(f.app.innerHTML, /学校开放的真实课程会出现在这里/);
  assert.ok(f.listeners.has("[data-courses-retry]:click"));
  assert.equal(JSON.stringify(f.calls), JSON.stringify([{ limit: 4 }]));
});

test("Today keeps a successful empty course catalog as an empty state", async () => {
  const f = mount({ courseResponse: { courses: [] } });
  await tick();

  assert.match(f.app.innerHTML, /当前学籍下没有可继续的课程任务/);
  assert.match(f.app.innerHTML, /href="\/student\/courses"/);
  assert.doesNotMatch(f.app.innerHTML, /课程列表暂时无法加载/);
});

test("Today preserves the dynamic assignment ID in a course detail link", async () => {
  const f = mount({
    courseResponse: {
      courses: [
        { assignmentId: "assignment/fixture", title: "TEST_FIXTURE_ONLY" },
      ],
    },
  });
  await tick();

  assert.match(f.app.innerHTML, /course-detail\/\?id=assignment%2Ffixture/);
});


test("Today uses a name instead of an account number and preserves a real profile name", async () => {
  const numeric = mount({ displayName: "13800000000" });
  const named = mount({ displayName: "次仁卓玛" });
  await tick();
  assert.match(numeric.app.innerHTML, /林晓，今天好/);
  assert.doesNotMatch(numeric.app.innerHTML, /13800000000/);
  assert.match(named.app.innerHTML, /次仁卓玛，今天好/);
});
