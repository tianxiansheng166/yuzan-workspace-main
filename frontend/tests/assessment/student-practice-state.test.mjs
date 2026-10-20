import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(
  new URL("../../assessment/assets/practice.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

const practice = {
  id: "definition-a",
  title: "真实专项练习 A",
  summary: "按本人开放投放显示",
  gradeBand: "四年级",
  difficulty: "基础",
  estimatedMinutes: 10,
  abilityCategories: ["朗读"],
  cultureTags: [],
  catalogType: "SPECIALIZED",
  mode: "SELF_PRACTICE",
  studentState: { completionStatus: "NOT_STARTED", favorite: false, attempt: null, recentResult: null },
  recommendationReason: "学校开放的练习",
  sections: [{ title: "朗读", estimatedMinutes: 10, itemCount: 1 }],
  oralItemCount: 1,
  writtenItemCount: 0,
  requiresRecording: true,
  scoringDisclosure: "提交后处理，未完成人工复核前不生成正式分数。",
};

async function mount({ status = "PROCESSING", page = "catalog" } = {}) {
  const root = { innerHTML: "" };
  let createCount = 0;
  const api = {
    getToken: () => "student-a-token",
    getActiveSchoolId: () => "school-a",
    getStoredUser: () => ({ id: "student-a" }),
    listPractices: async () => ({ items: [practice], facets: {}, total: 1, availableCount: 1, nextCursor: null }),
    listAssignedRemediations: async () => ({ items: [] }),
    listAssessmentSessions: async () => ({ items: [{ id: "attempt-a", enrollmentId: "enrollment-a", status }] }),
    getPracticeAttempt: async (id) => ({
      id,
      schoolId: "school-a",
      enrollmentId: "enrollment-a",
      initiatorUserId: "student-a",
      practiceDefinitionId: "definition-a",
      courseSubmissionId: null,
      courseActivityId: null,
      status,
      updatedAt: "2026-10-18T01:00:00.000Z",
    }),
    getPractice: async () => practice,
    createOrResumePractice: async () => { createCount += 1; return { attemptId: "duplicate-attempt" }; },
  };
  const context = vm.createContext({
    YuzanApi: api,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    location: { pathname: page === "catalog" ? "/student/practices/" : "/student/practices/definition-a/", search: "" },
    document: {
      body: { dataset: { practicePage: page } },
      querySelector: (selector) => (selector === "#app" ? root : null),
      querySelectorAll: () => [],
    },
    window: { YuzanApi: api, addEventListener() {} },
  });
  vm.runInContext(source, context, { filename: "frontend/assessment/assets/practice.js" });
  await flush();
  return { root, createCount: () => createCount };
}

test("practice catalog routes each real attempt status to the matching continuation", async (t) => {
  const cases = [
    ["CREATED", "待开始", "/student/practices/attempts/attempt-a/runner/"],
    ["IN_PROGRESS", "进行中", "/student/practices/attempts/attempt-a/runner/"],
    ["SUBMITTED", "已提交", "/student/practices/attempts/attempt-a/processing/"],
    ["PROCESSING", "处理中", "/student/practices/attempts/attempt-a/processing/"],
    ["FAILED", "处理失败", "/student/practices/attempts/attempt-a/processing/"],
  ];
  for (const [status, label, href] of cases) {
    await t.test(status, async () => {
      const view = await mount({ status });
      assert.match(view.root.innerHTML, new RegExp(label));
      assert.ok(view.root.innerHTML.includes(`href="${href}"`));
      assert.equal(view.createCount(), 0);
    });
  }
});

test("a submitted practice detail links to its real processing state and cannot create another attempt", async () => {
  const view = await mount({ status: "PROCESSING", page: "detail" });
  assert.match(view.root.innerHTML, /查看处理状态/);
  assert.ok(view.root.innerHTML.includes('href="/student/practices/attempts/attempt-a/processing/"'));
  assert.doesNotMatch(view.root.innerHTML, /data-start/);
  assert.equal(view.createCount(), 0);
});
