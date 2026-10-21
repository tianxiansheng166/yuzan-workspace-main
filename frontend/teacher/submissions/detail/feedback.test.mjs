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
    value: "",
    hidden: false,
    disabled: false,
    currentTime: 0,
    ended: false,
    paused: true,
    loadCalls: 0,
    focused: false,
    addEventListener(name, callback) {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "src") this._src = "";
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    load() { this.loadCalls += 1; },
    pause() {
      this.paused = true;
      for (const callback of listeners.get("pause") || []) callback();
    },
    focus() { this.focused = true; },
    async dispatch(name, event = {}) {
      event.preventDefault ||= () => { event.defaultPrevented = true; };
      let result;
      for (const callback of listeners.get(name) || []) result = callback(event);
      return result;
    },
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

async function loadPage(options = {}) {
  const ids = [
    "toast", "submissionAudio", "recordingStatus", "recordingSection", "recordingTitle",
    "recordingDuration", "studentName", "studentInfo", "crumbStudent", "submitTime",
    "assignmentTitle", "assignmentType", "submitStatus", "writtenAnswer", "autoScoreSection",
    "teacherReviewSection", "feedbackReadStatus", "feedbackEligibility", "feedbackComment",
    "feedbackCommentHint", "feedbackActionStatus", "feedbackForm", "btnRefreshFeedback",
    "btnGrade", "btnAccept", "btnReturn", "scorePronunciation", "scoreFluency",
    "scoreEmotion", "scoreOverall", "reviewStatus", "reviewComment", "reviewScore",
    "reviewReleasedAt",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
  const calls = [];
  const deferredTimers = [];
  const schoolId = options.schoolId || "school-dynamic-782";
  const submissionId = options.submissionId || "submission-dynamic-419";
  const submissionPath = `/schools/${encodeURIComponent(schoolId)}/submissions/${encodeURIComponent(submissionId)}`;
  const feedbackPath = `${submissionPath}/feedback`;
  const playbackPath = `${submissionPath}/recording-playback`;
  const location = {
    pathname: `/teacher/submissions/${submissionId}`,
    origin: "https://teacher.example.test",
    href: `https://teacher.example.test/teacher/submissions/${submissionId}`,
  };
  const document = {
    title: "",
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
  };
  const api = {
    submission: {
      id: submissionId,
      assignmentTitle: "朗读练习",
      status: Object.prototype.hasOwnProperty.call(options, "status") ? options.status : "NEEDS_REVIEW",
      feedback: { decision: "FAKE_LEGACY", comment: "不可显示的旧字段" },
      teacherComment: "不可显示的旧评语",
    },
    feedback: options.feedback || [],
    postErrors: [],
    submissionErrors: [],
    feedbackErrors: [],
    postGate: null,
    async request(path, requestOptions = {}) {
      const method = requestOptions.method || "GET";
      calls.push({ path, method, options: requestOptions });
      if (path === submissionPath && method === "GET") {
        const error = this.submissionErrors.shift();
        if (error) throw error;
        return { ...this.submission };
      }
      if (path === feedbackPath && method === "GET") {
        const error = this.feedbackErrors.shift();
        if (error) throw error;
        return this.feedback.map((record) => ({ ...record }));
      }
      if (path === playbackPath && method === "GET") {
        return options.playbackResponse || {
          id: "recording-dynamic-2",
          durationMs: 31000,
          downloadUrl: "https://media.example.test/signed/recording?token=valid",
        };
      }
      if (path === feedbackPath && method === "POST") {
        const error = this.postErrors.shift();
        if (error) throw error;
        if (this.postGate) await this.postGate;
        const body = JSON.parse(requestOptions.body || "{}");
        const record = {
          id: "feedback-dynamic-1",
          schoolId,
          submissionId,
          decision: body.decision,
          comment: body.comment,
          ...(body.score !== undefined ? { score: body.score } : {}),
          revision: this.feedback.length + 1,
          releasedAt: "2026-10-21T03:00:00.000Z",
        };
        this.feedback.push(record);
        this.submission.status = body.decision === "ACCEPT" ? "ACCEPTED" : "RETURNED";
        return record;
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
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
    YuzanApi: {
      getToken: () => "session-token",
      getActiveSchoolId: () => schoolId,
      request: (path, requestOptions) => api.request(path, requestOptions),
    },
    URL,
    Promise,
    Number,
    Math,
    String,
    Date,
    Array,
    Object,
    encodeURIComponent,
    setTimeout: (callback) => { deferredTimers.push(callback); return deferredTimers.length; },
    clearTimeout() {},
  };
  vm.runInNewContext(source, context, { filename: "teacher-submission-detail.js" });
  await context.__initialLoad;
  return {
    api,
    calls,
    context,
    deferredTimers,
    elements,
    feedbackPath,
    location,
    schoolId,
    submissionId,
    submissionPath,
    playbackPath,
  };
}

async function loadFeedback(page) {
  while (page.deferredTimers.length) {
    const callback = page.deferredTimers.shift();
    const result = callback();
    if (result && typeof result.then === "function") await result;
  }
}

function feedbackRecord(submissionId, overrides = {}) {
  return {
    id: "feedback-record-1",
    submissionId,
    decision: "RETURN",
    comment: "请把第三句读完整，并留意句末停顿。",
    score: 82,
    revision: 1,
    releasedAt: "2026-10-20T08:30:00.000Z",
    ...overrides,
  };
}

test("loads submission and independent feedback using dynamic IDs, showing the newest server record only", async () => {
  const page = await loadPage({
    feedback: [
      feedbackRecord("submission-dynamic-419", { revision: 1, releasedAt: "2026-10-19T08:00:00.000Z", comment: "较早的反馈" }),
      feedbackRecord("submission-dynamic-419", { revision: 2, decision: "ACCEPT", releasedAt: "2026-10-20T08:30:00.000Z", comment: "朗读清楚，停顿自然。", score: 0 }),
      feedbackRecord("another-submission", { comment: "不得串到当前提交" }),
    ],
  });
  await loadFeedback(page);

  assert.deepEqual(page.calls.map(({ path, method }) => [path, method]), [
    [page.submissionPath, "GET"],
    [page.playbackPath, "GET"],
    [page.feedbackPath, "GET"],
  ]);
  assert.equal(page.elements.submitStatus.textContent, "待复核");
  assert.equal(page.elements.reviewStatus.textContent, "已通过");
  assert.equal(page.elements.reviewComment.textContent, "朗读清楚，停顿自然。");
  assert.equal(page.elements.reviewScore.textContent, "0");
  assert.notEqual(page.elements.reviewReleasedAt.textContent, "—");
  assert.equal(page.elements.feedbackReadStatus.dataset.state, "ready");
  assert.doesNotMatch(page.elements.reviewComment.textContent, /不可显示/);
  assert.doesNotMatch(page.elements.reviewComment.textContent, /不得串到当前提交/);
  assert.equal(page.elements.btnAccept.disabled, false);
  assert.equal(page.elements.btnReturn.disabled, false);
});

test("review actions stay disabled unless the current server submission is NEEDS_REVIEW", async (t) => {
  for (const status of ["SUBMITTED", "PROCESSING", "ACCEPTED", "RETURNED", undefined]) {
    await t.test(`disables for ${String(status)}`, async () => {
      const page = await loadPage({ status });
      await loadFeedback(page);
      assert.equal(page.elements.btnAccept.disabled, true);
      assert.equal(page.elements.btnReturn.disabled, true);
      assert.equal(page.api.feedback.length, 0);
      assert.match(page.elements.feedbackEligibility.textContent, /只有待复核提交/);
    });
  }
});

test("posts ACCEPT with the teacher's trimmed comment and reads back authoritative state", async () => {
  const page = await loadPage();
  await loadFeedback(page);
  page.elements.feedbackComment.value = "  朗读清晰，第三句停顿自然。  ";
  const event = {};
  await page.elements.btnAccept.dispatch("click", event);

  const post = page.calls.find((call) => call.method === "POST");
  assert.ok(post);
  assert.equal(post.path, page.feedbackPath);
  assert.deepEqual(JSON.parse(post.options.body), {
    decision: "ACCEPT",
    comment: "朗读清晰，第三句停顿自然。",
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(page.elements.submitStatus.textContent, "已通过");
  assert.equal(page.elements.reviewStatus.textContent, "已通过");
  assert.equal(page.elements.reviewComment.textContent, "朗读清晰，第三句停顿自然。");
  assert.match(page.elements.feedbackActionStatus.textContent, /已从服务器同步/);
  assert.equal(page.elements.btnAccept.disabled, true);
  assert.equal(page.elements.btnReturn.disabled, true);
  assert.equal(page.elements.feedbackComment.value, "");
});

test("posts RETURN rather than the unsupported REJECT decision", async () => {
  const page = await loadPage();
  await loadFeedback(page);
  page.elements.feedbackComment.value = "请补录最后一句，并确认录音已完整上传。";
  await page.elements.btnReturn.dispatch("click");

  const post = page.calls.find((call) => call.method === "POST");
  assert.deepEqual(JSON.parse(post.options.body), {
    decision: "RETURN",
    comment: "请补录最后一句，并确认录音已完整上传。",
  });
  assert.equal(page.elements.submitStatus.textContent, "已退回");
  assert.equal(page.elements.reviewStatus.textContent, "已退回");
  assert.equal(page.elements.reviewComment.textContent, "请补录最后一句，并确认录音已完整上传。");
});

test("rejects an empty or whitespace-only comment without writing", async (t) => {
  for (const comment of ["", " \n\t  "]) {
    await t.test(JSON.stringify(comment), async () => {
      const page = await loadPage();
      await loadFeedback(page);
      page.elements.feedbackComment.value = comment;
      await page.elements.btnAccept.dispatch("click");
      assert.equal(page.calls.filter((call) => call.method === "POST").length, 0);
      assert.match(page.elements.feedbackActionStatus.textContent, /填写有内容的评语/);
      assert.equal(page.elements.feedbackComment.focused, true);
    });
  }
});

test("prevents duplicate clicks while the POST is still pending", async () => {
  const page = await loadPage();
  await loadFeedback(page);
  page.elements.feedbackComment.value = "本次朗读声音清楚。";
  let releasePost;
  page.api.postGate = new Promise((resolve) => { releasePost = resolve; });

  const first = page.elements.btnAccept.dispatch("click");
  await Promise.resolve();
  await page.elements.btnAccept.dispatch("click");
  assert.equal(page.calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(page.elements.btnAccept.disabled, true);
  releasePost();
  await first;
  assert.equal(page.calls.filter((call) => call.method === "POST").length, 1);
});

test("surfaces feedback errors and requires a GET refresh after uncertain outcomes", async (t) => {
  const cases = [
    [400, /内容无效/],
    [401, /登录已过期/],
    [403, /无权处理/],
    [404, /提交不存在/],
    [409, /状态已变化/],
    [500, /无法确认反馈是否保存/],
    [undefined, /网络连接失败/],
  ];
  for (const [status, expected] of cases) {
    await t.test(`POST ${status ?? "offline"}`, async () => {
      const page = await loadPage();
      await loadFeedback(page);
      page.elements.feedbackComment.value = "这次回答需要补充细节。";
      const error = new Error("untrusted server detail");
      if (status !== undefined) error.status = status;
      page.api.postErrors.push(error);
      await page.elements.btnReturn.dispatch("click");

      assert.match(page.elements.feedbackActionStatus.textContent, expected);
      assert.doesNotMatch(page.elements.feedbackActionStatus.textContent, /反馈已保存，提交状态/);
      assert.equal(page.api.feedback.length, 0);
      if (status === 400) {
        assert.equal(page.elements.btnReturn.disabled, false);
        assert.equal(page.elements.btnRefreshFeedback.hidden, true);
      } else {
        assert.equal(page.elements.btnReturn.disabled, true);
        assert.equal(page.elements.btnRefreshFeedback.hidden, false);
      }
    });
  }
});

test("reports POST success with failed refresh honestly and refreshes without a second POST", async () => {
  const page = await loadPage();
  await loadFeedback(page);
  page.elements.feedbackComment.value = "请把尾音读完整。";
  page.api.submissionErrors.push(Object.assign(new Error("offline"), {}));
  await page.elements.btnReturn.dispatch("click");

  assert.equal(page.calls.filter((call) => call.method === "POST").length, 1);
  assert.match(page.elements.feedbackActionStatus.textContent, /反馈已保存，但状态刷新失败/);
  assert.equal(page.elements.btnRefreshFeedback.hidden, false);
  assert.equal(page.elements.btnReturn.disabled, true);

  await page.elements.btnRefreshFeedback.dispatch("click");
  assert.equal(page.calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(page.elements.submitStatus.textContent, "已退回");
  assert.equal(page.elements.reviewComment.textContent, "请把尾音读完整。");
  assert.equal(page.elements.btnRefreshFeedback.hidden, true);
  assert.match(page.elements.feedbackActionStatus.textContent, /已从服务器刷新/);
});

test("feedback read failures block decisions until both server resources refresh", async () => {
  const page = await loadPage();
  page.api.feedbackErrors.push(Object.assign(new Error("forbidden"), { status: 403 }));
  await loadFeedback(page);

  assert.equal(page.elements.btnAccept.disabled, true);
  assert.equal(page.elements.btnReturn.disabled, true);
  assert.equal(page.elements.btnRefreshFeedback.hidden, false);
  assert.match(page.elements.feedbackReadStatus.textContent, /无权读取/);
  await page.elements.btnRefreshFeedback.dispatch("click");
  assert.equal(page.elements.btnAccept.disabled, false);
  assert.equal(page.elements.btnReturn.disabled, false);
  assert.equal(page.elements.btnRefreshFeedback.hidden, true);
});

test("preserves authorized playback, dynamic grade navigation, and accessible feedback controls", async () => {
  const page = await loadPage();
  await loadFeedback(page);
  assert.equal(page.elements.submissionAudio.src, "https://media.example.test/signed/recording?token=valid");
  assert.equal(page.elements.submissionAudio.hidden, false);
  await page.elements.btnGrade.dispatch("click");
  assert.equal(page.location.href, `/teacher/reviews/${page.submissionId}`);
  assert.match(htmlSource, /<audio[^>]*controls[^>]*aria-label="学生提交录音"/);
  assert.match(htmlSource, /<label[^>]*for="feedbackComment"/);
  assert.match(htmlSource, /id="feedbackActionStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(htmlSource, /id="feedbackReadStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(appSource, /school-(?:1|active-1)|submission-(?:1|from-path)/);
});
