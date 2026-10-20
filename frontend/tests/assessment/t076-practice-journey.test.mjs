import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const practiceSource = readFileSync(
  new URL("../../assessment/assets/practice.js", import.meta.url),
  "utf8",
);
const runnerSource = readFileSync(
  new URL("../../assessment/assets/runner.js", import.meta.url),
  "utf8",
);
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const validPractice = {
  id: "definition-t076",
  title: "T076 fixture practice",
  summary: "TEST_FIXTURE_ONLY",
  gradeBand: "四年级",
  difficulty: "基础",
  estimatedMinutes: 10,
  abilityCategories: ["阅读理解"],
  cultureTags: [],
  catalogType: "SPECIALIZED",
  mode: "SELF_PRACTICE",
  itemTypes: ["SINGLE_CHOICE"],
  studentState: { completionStatus: "NOT_STARTED", favorite: false },
  recommendationReason: "TEST_FIXTURE_ONLY",
  sections: [{ title: "阅读", itemCount: 1 }],
  oralItemCount: 0,
  writtenItemCount: 1,
  requiresRecording: false,
  scoringDisclosure: "结果以服务器状态为准。",
};

async function mountPractice({ page = "catalog", practice = validPractice } = {}) {
  const root = { innerHTML: "" };
  const api = {
    getToken: () => "fixture-token",
    listPractices: async () => ({ items: [practice], facets: {}, total: 1, nextCursor: null }),
    listAssignedRemediations: async () => ({ items: [] }),
    listAssessmentSessions: async () => ({ items: [] }),
    getPractice: async () => practice,
    createOrResumePractice: async () => ({ attemptId: "attempt-t076" }),
  };
  const document = {
    body: { dataset: { practicePage: page } },
    querySelector: (selector) => (selector === "#app" ? root : null),
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    YuzanApi: api,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    location: {
      pathname:
        page === "catalog"
          ? "/student/practices/"
          : "/student/practices/definition-t076/",
      search: "",
    },
    document,
    window: { YuzanApi: api, addEventListener() {} },
  });
  vm.runInContext(practiceSource, context, {
    filename: "frontend/assessment/assets/practice.js",
  });
  await tick();
  return root;
}

function fakeElement() {
  const listeners = new Map();
  return {
    listeners,
    dataset: {},
    value: "",
    disabled: false,
    classList: { toggle() {} },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    setAttribute() {},
    focus() {},
    closest(selector) {
      const match = selector.match(/^\[data-([\w-]+)\]$/);
      const key = match?.[1].replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return key && key in this.dataset ? this : null;
    },
  };
}

async function mountRunner({ api, attemptId = "attempt-t076" }) {
  let markup = "";
  let elements = new Map();
  const app = {
    get innerHTML() {
      return markup;
    },
    set innerHTML(value) {
      markup = value;
      elements = new Map();
    },
  };
  const elementFor = (selector) => {
    if (selector === "#app") return app;
    if (selector.startsWith(".")) {
      return markup.includes(selector.slice(1)) ? getElement(selector) : null;
    }
    const match = selector.match(/^\[data-([\w-]+)\]$/);
    if (!match || !markup.includes(`data-${match[1]}`)) return null;
    const element = getElement(selector);
    element.dataset[match[1].replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = "";
    return element;
  };
  const getElement = (selector) => {
    if (!elements.has(selector)) {
      const element = fakeElement();
      if (selector === "[data-text]") {
        element.value = markup.match(/<textarea[^>]*data-text[^>]*>([\s\S]*?)<\/textarea>/)?.[1] || "";
      }
      elements.set(selector, element);
    }
    return elements.get(selector);
  };
  const document = {
    querySelector: elementFor,
    querySelectorAll: () => [],
  };
  const assigned = [];
  const location = {
    pathname: `/student/practices/attempts/${attemptId}/runner/`,
    assign: (path) => assigned.push(path),
  };
  const context = vm.createContext({
    YuzanApi: api,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener() {},
    location,
    document,
    window: { YuzanApi: api, addEventListener() {} },
  });
  vm.runInContext(runnerSource, context, {
    filename: "frontend/assessment/assets/runner.js",
  });
  await tick();
  const click = async (selector) => {
    const element = elementFor(selector);
    assert.ok(element, `expected ${selector} in current runner markup`);
    const callback = element.listeners.get("click");
    assert.equal(typeof callback, "function", `expected click handler for ${selector}`);
    return callback({ currentTarget: element, target: element });
  };
  return { app, assigned, click, elementFor };
}

test("empty catalog and detail versions are explicitly unavailable", async () => {
  const emptyPractice = {
    ...validPractice,
    itemTypes: [],
    sections: [{ title: "阅读", itemCount: 0 }],
    writtenItemCount: 0,
  };
  const catalog = await mountPractice({ practice: emptyPractice });
  assert.match(catalog.innerHTML, /暂不可用|没有可作答题目/);

  const detail = await mountPractice({ page: "detail", practice: emptyPractice });
  assert.match(detail.innerHTML, /暂不可用|没有可作答题目/);
  assert.doesNotMatch(detail.innerHTML, /data-start/);
});

test("a non-empty practice remains startable from its detail", async () => {
  const detail = await mountPractice({ page: "detail" });
  assert.match(detail.innerHTML, /data-start/);
  assert.doesNotMatch(detail.innerHTML, /practice-unavailable|没有可作答题目/);
});

test("409 answer save and lost submit response reconcile against the same server Attempt", async () => {
  const serverItem = {
    id: "item-t076",
    itemType: "WRITTEN",
    prompt: {
      stimulus: { type: "TEXT", promptText: "TEST_FIXTURE_ONLY" },
      response: { type: "TEXT" },
    },
    studentAnswer: null,
  };
  let serverStatus = "IN_PROGRESS";
  let attemptReads = 0;
  let itemReads = 0;
  let submitCalls = 0;
  const api = {
    requireAuth: () => true,
    getCoursePracticeContext: () => null,
    getPracticeAttempt: async (id) => {
      assert.equal(id, "attempt-t076");
      attemptReads += 1;
      return { id, enrollmentId: "fixture-enrollment", status: serverStatus };
    },
    getPracticeAttemptItems: async (id) => {
      assert.equal(id, "attempt-t076");
      itemReads += 1;
      return [serverItem];
    },
    saveWrittenAnswer: async (id, itemId, payload) => {
      assert.equal(id, "attempt-t076");
      assert.equal(itemId, "item-t076");
      serverItem.studentAnswer = { content: payload.content };
      throw Object.assign(new Error("stale answer response"), { status: 409 });
    },
    finalizeWrittenAnswer: async () => {},
    submitAssessmentSession: async (id) => {
      assert.equal(id, "attempt-t076");
      submitCalls += 1;
      serverStatus = "PROCESSING";
      throw Object.assign(new Error("response lost"), { status: 0 });
    },
  };
  const runner = await mountRunner({ api });
  const answer = runner.elementFor("[data-text]");
  assert.ok(answer);
  answer.value = "已经保存的答案";

  await runner.click("[data-submit]");
  assert.match(runner.app.innerHTML, /data-confirm-submit/);
  await runner.click("[data-confirm-submit]");
  await tick();

  assert.equal(itemReads, 2, "the runner must read the server answer after 409");
  assert.equal(attemptReads, 3, "boot, save recovery, and submit recovery read this Attempt");
  assert.equal(submitCalls, 1, "the accepted submit must not be blindly repeated");
  assert.deepEqual(runner.assigned, [
    "/student/practices/attempts/attempt-t076/processing/",
  ]);
});

test("uncertain submit stays locked until an explicit same-Attempt status check succeeds", async () => {
  let attemptReads = 0;
  let submitCalls = 0;
  const api = {
    requireAuth: () => true,
    getCoursePracticeContext: () => null,
    getPracticeAttempt: async (id) => {
      assert.equal(id, "attempt-t076");
      attemptReads += 1;
      if (attemptReads === 2) throw Object.assign(new Error("network unavailable"), { status: 0 });
      return { id, enrollmentId: "fixture-enrollment", status: "IN_PROGRESS" };
    },
    getPracticeAttemptItems: async () => [{
      id: "item-t076",
      itemType: "LISTEN_ONLY",
      prompt: { stimulus: { type: "TEXT", promptText: "TEST_FIXTURE_ONLY" }, response: { type: "NONE" } },
    }],
    submitAssessmentSession: async (id) => {
      assert.equal(id, "attempt-t076");
      submitCalls += 1;
      throw Object.assign(new Error("response lost"), { status: 0 });
    },
  };
  const runner = await mountRunner({ api });

  await runner.click("[data-submit]");
  await runner.click("[data-confirm-submit]");
  await tick();
  assert.equal(submitCalls, 1);
  assert.match(runner.app.innerHTML, /data-retry-attempt-check/);
  assert.match(runner.app.innerHTML, /data-submit disabled/);

  const retryAction = runner.elementFor("[data-retry-attempt-check]");
  const message = runner.elementFor("[data-runner-message]");
  await message.listeners.get("click")({ currentTarget: message, target: retryAction });
  await tick();
  assert.equal(attemptReads, 3);
  assert.equal(submitCalls, 1, "status retry performs GET only and never repeats POST");
  assert.doesNotMatch(runner.app.innerHTML, /data-submit disabled/);
});

test("attempt deep-link failures keep 401, 403, and 404 distinct", async (t) => {
  const cases = [
    [401, /登录状态已过期/],
    [403, /当前身份无权访问/],
    [404, /练习不存在或已不可访问/],
  ];
  for (const [status, expected] of cases) {
    await t.test(String(status), async () => {
      const api = {
        requireAuth: () => true,
        getPracticeAttempt: async () => {
          throw Object.assign(new Error("access denied"), { status });
        },
      };
      const runner = await mountRunner({ api });
      assert.match(runner.elementFor("[data-boot-error]")?.textContent || "", expected);
      assert.match(runner.app.innerHTML, /重新加载本次练习/);
      assert.deepEqual(runner.assigned, []);
    });
  }
});
