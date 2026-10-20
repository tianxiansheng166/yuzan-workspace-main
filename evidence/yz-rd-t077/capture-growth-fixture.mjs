import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const cdpPort = Number(process.env.YZ_T077_CDP_PORT || 9224);
const baseUrl = process.env.YZ_T077_BASE_URL || "http://127.0.0.1:41777";
const outputDirectory = fileURLToPath(new URL("./screenshots/", import.meta.url));
const userId = "student-t077-fixture";
const schoolId = "school-t077-fixture";
const enrollmentId = "enrollment-t077-fixture";
const completedAt = "2026-10-18T09:00:00.000Z";

const sessions = [
  { sessionId: "assessment-t077-zero", purpose: "STANDARD", type: "READING", completedAt, metrics: { overall: 0 }, remediation: null },
  { sessionId: "assessment-t077-null", purpose: "STANDARD", type: "WRITTEN", completedAt, metrics: null, remediation: null },
  { sessionId: "assessment-t077-error", purpose: "STANDARD", type: "READING", completedAt, metrics: null, remediation: null },
];
const sourceRecords = Object.fromEntries(sessions.map(({ sessionId }) => [sessionId, {
  id: sessionId,
  schoolId,
  enrollmentId,
  purpose: "STANDARD",
  status: "COMPLETED",
  completedAt,
}]));
const reportRecords = {
  "assessment-t077-zero": {
    id: "report-t077-zero-fixture",
    sessionId: "assessment-t077-zero",
    schoolId,
    overallScore: 0,
    dataCompleteness: 100,
    generatedAt: "2026-10-18T09:05:00.000Z",
    summary: {},
    diagnosis: { retryCandidates: [{ questionVersionId: "question-version-t077-fixture", family: "句子理解", displayName: "句子理解" }] },
    teacherFeedback: [{ comment: "朗读清楚，请继续练习自然停顿。", reviewedAt: "2026-10-18T09:06:00.000Z" }],
  },
  "assessment-t077-null": {
    id: "report-t077-null-fixture",
    sessionId: "assessment-t077-null",
    schoolId,
    overallScore: null,
    dataCompleteness: 100,
    generatedAt: "2026-10-18T09:07:00.000Z",
    summary: {},
    diagnosis: { retryCandidates: [] },
    teacherFeedback: [{ comment: "本次结果暂无正式得分。", reviewedAt: "2026-10-18T09:08:00.000Z" }],
  },
};

const injectedFixture = `(() => {
  const userId = ${JSON.stringify(userId)};
  const schoolId = ${JSON.stringify(schoolId)};
  const enrollmentId = ${JSON.stringify(enrollmentId)};
  const sessions = ${JSON.stringify(sessions)};
  const sourceRecords = ${JSON.stringify(sourceRecords)};
  const reportRecords = ${JSON.stringify(reportRecords)};
  localStorage.setItem("yuzan-access-token", "TEST_FIXTURE_ONLY");
  localStorage.setItem("yuzan-active-school-id", schoolId);
  localStorage.setItem("yuzan-current-user", JSON.stringify({ id: userId }));
  window.YuzanApi = {
    getToken: () => "TEST_FIXTURE_ONLY",
    getStoredUser: () => ({ id: userId }),
    getActiveSchoolId: () => schoolId,
    getStudentProfile: async () => ({ profile: { userId, enrollmentId, displayName: "测试学生（合成数据）", schoolName: "隔离测试学校", gradeBand: "七年级", className: "测试班" } }),
    getAssessmentHistory: async () => ({ enrollmentId, sessions }),
    getQuestionBankProgress: async () => ({ version: "qb-progress-v1", state: "EMPTY_STATE", formalLevels: [], remediation: [], milestones: [], latest: null }),
    getAssessmentHistoryEvents: async () => ({ enrollmentId, events: [{ id: "feedback-t077-fixture", type: "FEEDBACK", title: "课堂教师反馈", description: "请保持自然停顿。\\n下一次练习注意句尾语气。", timestamp: "2026-10-18T09:10:00.000Z" }] }),
    listAssessmentSessions: async () => ({ items: [], nextCursor: null, hasMore: false }),
    listPractices: async () => ({ items: [] }),
    getPracticeAttempt: async () => { throw Object.assign(new Error("not a practice attempt"), { status: 404 }); },
    getAssessmentSession: async (id) => sourceRecords[id] ?? null,
    getAssessmentReport: async (id) => {
      if (id === "assessment-t077-error") throw Object.assign(new Error("报告服务暂时不可用"), { status: 503 });
      return reportRecords[id] ?? null;
    },
  };
})();`;

const browser = await fetch(`http://127.0.0.1:${cdpPort}/json/version`).then((response) => response.json());
const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextCommandId = 0;
const pendingCommands = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const pending = pendingCommands.get(message.id);
  if (!pending) return;
  pendingCommands.delete(message.id);
  if (message.error) pending.reject(new Error(message.error.message));
  else pending.resolve(message.result || {});
});

function command(method, params = {}) {
  const id = ++nextCommandId;
  return new Promise((resolve, reject) => {
    pendingCommands.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}

await command("Page.enable");
await command("Runtime.enable");
await command("Network.enable");
await command("Network.setBlockedURLs", { urls: ["*assets/api-client.js*"] });
await command("Page.addScriptToEvaluateOnNewDocument", { source: injectedFixture });

const screenshots = [];
for (const viewport of [{ width: 1280, height: 900 }, { width: 1440, height: 1000 }]) {
  await command("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: false });
  let loadEvent;
  const loaded = new Promise((resolve) => { loadEvent = resolve; });
  const onLoad = (event) => {
    if (JSON.parse(event.data).method === "Page.loadEventFired") {
      socket.removeEventListener("message", onLoad);
      loadEvent();
    }
  };
  socket.addEventListener("message", onLoad);
  await command("Page.navigate", { url: `${baseUrl}/student/growth/` });
  await Promise.race([loaded, delay(15000)]);
  let pageState;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    pageState = await evaluate(`(() => ({ state: document.querySelector("#growthApp")?.dataset.state || "missing", text: document.querySelector("#growthApp")?.innerText || "" }))()`);
    if (pageState.state === "ready") break;
    await delay(100);
  }
  assert.equal(pageState.state, "ready", `Growth fixture failed to render: ${pageState.text}`);
  const measurement = await evaluate(`(() => ({
    title: document.querySelector("#growthApp h1")?.innerText,
    viewportWidth: window.innerWidth,
    layoutWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    zeroScoreVisible: document.querySelector("#growthApp")?.innerText.includes("0 分"),
    nullScoreVisible: document.querySelector("#growthApp")?.innerText.includes("暂无正式得分"),
    partialReportErrorVisible: document.querySelector("#growthApp")?.innerText.includes("暂时无法读取"),
    feedbackVisible: document.querySelector("#growthApp")?.innerText.includes("下一次练习注意句尾语气。"),
    reportLinks: Array.from(document.querySelectorAll(".growth-report-row > a[href]"), (link) => link.getAttribute("href")),
    remediationButtons: document.querySelectorAll("[data-growth-remediation]").length,
  }))()`);
  assert.equal(measurement.documentWidth, measurement.layoutWidth, "Growth page must not overflow its layout viewport");
  assert.ok(measurement.layoutWidth <= viewport.width, "Layout viewport must stay within the requested desktop width");
  assert.equal(measurement.zeroScoreVisible, true, "Explicit formal zero should remain visible");
  assert.equal(measurement.nullScoreVisible, true, "Missing formal score should remain separate from zero");
  assert.equal(measurement.partialReportErrorVisible, true, "A report fetch error should remain visible beside complete reports");
  assert.equal(measurement.feedbackVisible, true, "Multiline teacher feedback should remain visible");
  assert.equal(measurement.remediationButtons, 1, "Only the valid report candidate should expose a remediation action");

  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: viewport.width, height: measurement.pageHeight, scale: 1 },
  });
  const fileName = `growth-fixture-${viewport.width}x${viewport.height}.png`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(new URL(`./screenshots/${fileName}`, import.meta.url), Buffer.from(screenshot.data, "base64"));
  screenshots.push({ fileName, ...measurement });
}

await writeFile(new URL("./browser-proof.json", import.meta.url), `${JSON.stringify({
  classification: "TEST_FIXTURE_ONLY",
  browser: browser.Browser,
  baseUrl,
  source: "Growth page served from the T077 worktree with in-browser API fixture data.",
  screenshots,
}, null, 2)}\n`);
socket.close();
console.log(JSON.stringify(screenshots, null, 2));
