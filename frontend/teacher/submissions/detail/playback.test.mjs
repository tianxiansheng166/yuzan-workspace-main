import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const initialLoad = /\n  submissionId = getSubmissionIdFromPath\(\);\n  loadSubmissionDetail\(\);\n\}\)\(\);\s*$/;

function makeElement(id) {
  const listeners = new Map();
  const attributes = new Map();
  const element = {
    id,
    listeners,
    attributes,
    dataset: {},
    style: {},
    textContent: "",
    hidden: false,
    currentTime: 0,
    ended: false,
    paused: true,
    loadCalls: 0,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "src") this._src = "";
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    load() { this.loadCalls += 1; },
    pause() {
      this.paused = true;
      listeners.get("pause")?.();
    },
    dispatch(name) { listeners.get(name)?.(); },
    classList: { add() {}, remove() {} },
  };
  Object.defineProperty(element, "src", {
    get() { return element._src || ""; },
    set(value) {
      element._src = value;
      attributes.set("src", value);
    },
  });
  return element;
}

async function loadPage({ playbackResponse, playbackError, legacyUrl = "https://legacy.invalid/audio" }) {
  const ids = [
    "toast", "submissionAudio", "recordingStatus", "recordingSection", "recordingTitle",
    "recordingDuration", "studentName", "studentInfo", "crumbStudent", "submitTime",
    "assignmentTitle", "assignmentType", "submitStatus", "writtenAnswer", "autoScoreSection",
    "teacherReviewSection", "btnGrade", "btnAccept", "btnReturn", "scorePronunciation",
    "scoreFluency", "scoreEmotion", "scoreOverall", "reviewStatus", "reviewComment", "reviewScore",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
  const requests = [];
  const schoolId = "school-active-1";
  const submissionId = "submission-from-path";
  const location = {
    pathname: `/teacher/submissions/${submissionId}`,
    origin: "https://teacher.example.test",
    href: "https://teacher.example.test/teacher/submissions/submission-from-path",
  };
  const document = {
    title: "",
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
  };
  const YuzanApi = {
    getToken: () => "session-token",
    getActiveSchoolId: () => schoolId,
    async request(path) {
      requests.push(path);
      if (path === `/schools/${schoolId}/submissions/${submissionId}`) {
        return {
          id: submissionId,
          assignmentTitle: "朗读练习",
          status: "SUBMITTED",
          recordingUrl: legacyUrl,
        };
      }
      if (playbackError) throw playbackError;
      return playbackResponse;
    },
  };
  const source = appSource.replace(
    initialLoad,
    "\n  submissionId = getSubmissionIdFromPath();\n  globalThis.__initialLoad = loadSubmissionDetail();\n})();\n",
  );
  assert.notEqual(source, appSource, "app keeps a testable isolated IIFE entry point");
  const context = {
    document,
    location,
    YuzanApi,
    URL,
    Promise,
    Number,
    Math,
    String,
    encodeURIComponent,
    setTimeout: () => 1,
    clearTimeout() {},
  };
  vm.runInNewContext(source, context, { filename: "teacher-submission-detail.js" });
  await context.__initialLoad;
  return { elements, requests, schoolId, submissionId };
}

test("loads playback only from the dynamic school and submission scoped response", async () => {
  const { elements, requests, schoolId, submissionId } = await loadPage({
    playbackResponse: {
      id: "recording-1",
      durationMs: 65000,
      mimeType: "audio/webm",
      downloadUrl: "https://storage.example.test/signed/authorized-audio?token=one",
    },
  });

  assert.deepEqual(requests, [
    `/schools/${schoolId}/submissions/${submissionId}`,
    `/schools/${encodeURIComponent(schoolId)}/submissions/${encodeURIComponent(submissionId)}/recording-playback`,
  ]);
  assert.equal(elements.submissionAudio.src, "https://storage.example.test/signed/authorized-audio?token=one");
  assert.equal(elements.submissionAudio.hidden, false);
  assert.equal(elements.recordingDuration.textContent, "时长：1:05");
  assert.equal(elements.recordingStatus.textContent, "录音已授权。使用播放器控件开始播放。");
  assert.equal(elements.recordingStatus.dataset.state, "ready");
  assert.doesNotMatch(elements.recordingStatus.textContent, /正在播放/);
});

test("does not use legacy recordingUrl or invalid server playback URLs", async (t) => {
  for (const downloadUrl of ["", "   ", "javascript:alert(1)", undefined]) {
    await t.test(`rejects ${String(downloadUrl)}`, async () => {
      const { elements } = await loadPage({
        playbackResponse: { downloadUrl },
        legacyUrl: "https://legacy.invalid/must-not-play.mp3",
      });

      assert.equal(elements.submissionAudio.src, "");
      assert.equal(elements.submissionAudio.hidden, true);
      assert.equal(elements.recordingStatus.dataset.state, "no-recording");
    });
  }
});

test("shows an accessible authorization state and clears any previous source", async () => {
  const { elements } = await loadPage({
    playbackError: Object.assign(new Error("forbidden"), { status: 403 }),
  });

  assert.equal(elements.submissionAudio.src, "");
  assert.equal(elements.submissionAudio.hidden, true);
  assert.equal(elements.recordingStatus.dataset.state, "authorization-error");
  assert.match(elements.recordingStatus.textContent, /无权查看或播放/);
});

test("native playback events report playback and media failure clears the source", async () => {
  const { elements } = await loadPage({
    playbackResponse: { downloadUrl: "https://storage.example.test/signed/audio" },
  });
  const audio = elements.submissionAudio;

  audio.dispatch("playing");
  assert.equal(elements.recordingStatus.dataset.state, "playing");
  assert.match(elements.recordingStatus.textContent, /正在播放/);

  audio.dispatch("error");
  assert.equal(audio.src, "");
  assert.equal(audio.hidden, true);
  assert.equal(elements.recordingStatus.dataset.state, "media-error");
  assert.match(elements.recordingStatus.textContent, /媒体加载失败/);
});

test("renders native audio controls and a live status for assistive technology", () => {
  assert.match(htmlSource, /<audio[^>]*controls[^>]*aria-label="学生提交录音"/);
  assert.match(htmlSource, /id="recordingStatus"[^>]*role="status"[^>]*aria-live="polite"/);
});
