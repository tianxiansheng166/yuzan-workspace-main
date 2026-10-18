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
      for (const selector of ["[data-retry]", "[data-history-more]", "[data-history-events-retry]"]) {
        if (!this.html.includes(selector.slice(1, -1))) continue;
        if (!nodes.has(selector)) nodes.set(selector, { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } });
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
        items: [{ id: "attempt-a-processing", enrollmentId: "enrollment-a", purpose: "STANDARD", type: "MIXED", status: "PROCESSING", createdAt: "2026-10-18T01:00:00.000Z", updatedAt: "2026-10-18T01:02:00.000Z" }],
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
  };

  const view = mount(api, storageData);
  assert.doesNotMatch(view.root.innerHTML, /attempt-b-secret|student-b-private-feedback|99/);
  await flush();

  assert.equal(calls[0][0], "sessions");
  assert.equal(calls[0][1].limit, 100);
  assert.equal(calls[1][0], "history");
  assert.equal(calls[1][1].enrollmentId, "enrollment-a");
  assert.equal(calls[1][1].range, "all");
  assert.deepEqual(calls[2], ["events", "enrollment-a"]);
  assert.match(view.root.innerHTML, /attempt-a-processing/);
  assert.match(view.root.innerHTML, /处理中/);
  assert.match(view.root.innerHTML, /查看处理状态/);
  assert.match(view.root.innerHTML, /\/assessment\/sessions\/attempt-a-processing\/processing\//);
  assert.match(view.root.innerHTML, /正式报告 84 分/);
  assert.match(view.root.innerHTML, /student-a-feedback/);
  assert.doesNotMatch(view.root.innerHTML, /attempt-b-secret|student-b-private-feedback|99/);

  const saved = JSON.parse(storageData.get("yuzan-assessment-v5-nosession"));
  assert.equal("apiHistory" in saved, false);
  assert.equal("apiSessionPage" in saved, false);
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
