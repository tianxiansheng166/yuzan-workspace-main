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
const visualsSource = readFileSync(
  new URL("../../assessment/assets/practice-visuals.js", import.meta.url),
  "utf8",
);
const visualsCss = readFileSync(
  new URL("../../assessment/assets/practice-visuals.css", import.meta.url),
  "utf8",
);
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

const practiceFixture = {
  id: "definition-t012",
  title: "T012 真实状态专项练习",
  summary: "学生本人可见的开放练习。",
  gradeBand: "七年级",
  difficulty: "基础",
  estimatedMinutes: 10,
  abilityCategories: ["听辨训练"],
  cultureTags: ["听说"],
  catalogType: "SPECIALIZED",
  mode: "SELF_PRACTICE",
  studentState: {
    completionStatus: "NOT_STARTED",
    favorite: false,
    attempt: null,
    recentResult: null,
  },
  recommendationReason: "当前开放",
  sections: [{ title: "听说练习", estimatedMinutes: 10, itemCount: 1 }],
  oralItemCount: 1,
  writtenItemCount: 0,
  requiresRecording: true,
  scoringDisclosure: "录音以服务器处理状态为准。",
};

async function mountPractice(status, { page = "catalog", pages } = {}) {
  const root = { innerHTML: "" };
  const api = {
    getToken: () => "student-a-token",
    listPractices: async () => ({
      items: [practiceFixture],
      facets: { abilityCategory: [{ value: "听辨训练", count: 1 }] },
      total: 1,
      availableCount: 1,
      nextCursor: null,
    }),
    listAssignedRemediations: async () => ({ items: [] }),
    listAssessmentSessions: async (options) =>
      pages?.[options?.cursor || "first"] || {
        items: [{ id: "attempt-t012", status }],
        nextCursor: null,
      },
    getPracticeAttempt: async (id) => {
      if (id !== "attempt-t012") {
        throw Object.assign(new Error("not a practice Attempt"), {
          status: 404,
        });
      }
      return {
        id,
        practiceDefinitionId: "definition-t012",
        status,
        updatedAt: "2026-10-18T01:00:00.000Z",
      };
    },
    getPractice: async () => practiceFixture,
    createOrResumePractice: async () => ({ attemptId: "new-attempt" }),
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
          : "/student/practices/definition-t012/",
      search: "",
    },
    document: {
      body: { dataset: { practicePage: page } },
      querySelector: (selector) => (selector === "#app" ? root : null),
      querySelectorAll: () => [],
    },
    window: { YuzanApi: api, addEventListener() {} },
  });
  vm.runInContext(practiceSource, context, {
    filename: "frontend/assessment/assets/practice.js",
  });
  await tick();
  return root;
}

test("favorites are sibling controls, never nested in the detail link", async () => {
  const root = await mountPractice("IN_PROGRESS");
  assert.match(
    root.innerHTML,
    /<a class="practice-cover"[\s\S]*?<\/a><button type="button" class="favorite-button/,
  );
  const coverAnchor = root.innerHTML.match(
    /<a class="practice-cover"[^>]*>[\s\S]*?<\/a>/,
  )?.[0];
  assert.ok(coverAnchor);
  assert.doesNotMatch(coverAnchor, /data-favorite/);
  assert.match(root.innerHTML, /aria-pressed="false"/);
  assert.match(
    root.innerHTML,
    /href="\/student\/practices\/definition-t012\/"/,
  );
});

test("all persisted Attempt states route to their matching legal action", async (t) => {
  const cases = [
    ["CREATED", "开始练习", "/runner/"],
    ["IN_PROGRESS", "继续练习", "/runner/"],
    ["SUBMITTED", "查看处理状态", "/processing/"],
    ["PROCESSING", "查看处理状态", "/processing/"],
    ["FAILED", "查看处理状态", "/processing/"],
    ["COMPLETED", "查看结果", "/report/"],
  ];
  for (const [status, label, route] of cases) {
    await t.test(status, async () => {
      const root = await mountPractice(status);
      assert.match(root.innerHTML, new RegExp(label));
      assert.ok(
        root.innerHTML.includes(
          "/student/practices/attempts/attempt-t012" + route,
        ),
      );
    });
  }
});

test("completed detail cannot accidentally create a second attempt", async () => {
  const root = await mountPractice("COMPLETED", { page: "detail" });
  assert.match(root.innerHTML, /查看结果/);
  assert.match(
    root.innerHTML,
    /\/student\/practices\/attempts\/attempt-t012\/report\//,
  );
  assert.doesNotMatch(root.innerHTML, /data-start/);
});

test("Attempt lookup follows real session cursors instead of stopping at page one", async () => {
  const pages = {
    first: {
      items: [{ id: "older-page-session", status: "IN_PROGRESS" }],
      nextCursor: "after-first",
    },
    "after-first": {
      items: [{ id: "attempt-t012", status: "COMPLETED" }],
      nextCursor: null,
    },
  };
  const root = await mountPractice("COMPLETED", { pages });
  assert.match(
    root.innerHTML,
    /href="\/student\/practices\/attempts\/attempt-t012\/report\//,
  );
});

test("runner exposes real confirmation, recovery, and microphone source states", () => {
  assert.match(runnerSource, /role="dialog" aria-modal="true"/);
  assert.match(runnerSource, /data-confirm-submit/);
  assert.match(runnerSource, /data-cancel-submit/);
  assert.match(runnerSource, /complete\(item\)/);
  assert.match(runnerSource, /getByteTimeDomainData\(samples\)/);
  assert.match(runnerSource, /SIMULATED_MIC/);
  assert.match(runnerSource, /MediaRecorder/);
  assert.match(runnerSource, /uploadBlobToPresignedUrl/);
  assert.match(runnerSource, /recordingIdempotencyKey/);
  assert.match(runnerSource, /服务器尚未确认录音绑定/);
  assert.match(runnerSource, /加载练习失败/);
});

test("custom visual system uses accessible SVGs and honors reduced motion", () => {
  const window = {};
  vm.runInNewContext(visualsSource, { window });
  const star = window.YuzanPracticeVisuals.icon("filledStar");
  const wave = window.YuzanPracticeVisuals.waveform({ bars: 8, kind: "input" });
  assert.match(star, /<svg[^>]+aria-hidden="true"/);
  assert.match(star, /fill="currentColor"/);
  assert.equal((wave.match(/data-wave-bar=/g) || []).length, 8);
  assert.match(visualsCss, /:focus-visible/);
  assert.match(visualsCss, /prefers-reduced-motion: reduce/);
  assert.match(visualsCss, /\.runner-audio-player\.is-playing/);
  assert.match(visualsCss, /\.runner-recording \.yz-waveform rect/);
});
