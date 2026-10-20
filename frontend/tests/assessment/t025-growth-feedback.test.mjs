import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(
  new URL("../../student/growth/assets/growth-live.js", import.meta.url),
  "utf8",
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const SOURCE_ID = "assessment-source-a";
const REPORT_ID = "formal-report-a";

function formalSource(overrides = {}) {
  return {
    id: SOURCE_ID,
    schoolId: "school-a",
    enrollmentId: "enrollment-a",
    purpose: "STANDARD",
    status: "COMPLETED",
    completedAt: "2026-10-18T09:00:00.000Z",
    ...overrides,
  };
}

function formalReport(overrides = {}) {
  return {
    id: REPORT_ID,
    sessionId: SOURCE_ID,
    schoolId: "school-a",
    overallScore: 72,
    dataCompleteness: 100,
    generatedAt: "2026-10-18T09:05:00.000Z",
    summary: {},
    diagnosis: {
      retryCandidates: [{
        assessmentItemId: "assessment-item-a",
        questionVersionId: "question-version-a",
        family: "句子理解",
        displayName: "句子理解",
      }],
    },
    teacherFeedback: [{
      comment: "朗读清楚，请继续练习自然停顿。",
      reviewedAt: "2026-10-18T08:55:00.000Z",
      reviewerUserId: "private-reviewer-a",
      rubric: { secret: "private-rubric" },
      answerKey: "private-answer",
      scoringSpec: { hidden: true },
    }],
    ...overrides,
  };
}

function mount({
  sourceRecord = formalSource(),
  reportRecord = formalReport(),
  historySessions = [{ sessionId: SOURCE_ID, purpose: "STANDARD", type: "MIXED", completedAt: formalSource().completedAt }],
  events = [],
  sessions = [],
  practices = [],
  overrides = {},
  storage = new Map(),
} = {}) {
  const statusNodes = new Map();
  const app = {
    dataset: {},
    listeners: {},
    attributes: new Map(),
    _innerHTML: "",
    get innerHTML() { return this._innerHTML; },
    set innerHTML(value) {
      this._innerHTML = value;
      statusNodes.clear();
      for (const match of value.matchAll(/data-remediation-status="([^"]+)"/g)) {
        const sourceSessionId = match[1].replaceAll("&amp;", "&").replaceAll("&quot;", '"');
        statusNodes.set(sourceSessionId, {
          dataset: { remediationStatus: sourceSessionId },
          innerHTML: "",
        });
      }
    },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    querySelector(selector) {
      if (selector === "[data-growth-retry]") return null;
      return null;
    },
    querySelectorAll(selector) {
      return selector === "[data-remediation-status]" ? [...statusNodes.values()] : [];
    },
  };
  const identity = { userId: "student-a", schoolId: "school-a", hasToken: true };
  const current = {
    sourceRecord,
    reportRecord,
    enrollmentId: "enrollment-a",
    historySessions,
    events,
    sessions,
    practices,
  };
  const calls = { post: [], listSessions: 0, listSessionEnrollmentIds: [], getSession: [], getReport: [] };
  const windowListeners = {};
  const sessionStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };
  const api = {
    getToken: () => identity.hasToken ? "token" : null,
    getStoredUser: () => ({ id: identity.userId }),
    getActiveSchoolId: () => identity.schoolId,
    getStudentProfile: async () => ({ profile: { userId: identity.userId, displayName: `学生${identity.userId}`, schoolName: `学校${identity.schoolId}` } }),
    getAssessmentHistory: async () => ({ enrollmentId: current.enrollmentId, sessions: current.historySessions }),
    getAssessmentHistoryEvents: async () => ({ events: current.events }),
    getQuestionBankProgress: async () => ({ version: "qb-progress-v1", state: "EMPTY_STATE", formalLevels: [], remediation: [], milestones: [], latest: null }),
    listAssessmentSessions: async (options = {}) => {
      calls.listSessions += 1;
      calls.listSessionEnrollmentIds.push(options.enrollmentId);
      return { items: current.sessions, nextCursor: null, hasMore: false };
    },
    listPractices: async () => ({ items: current.practices }),
    getPracticeAttempt: async (id) => {
      const session = current.sessions.find((entry) => entry.id === id);
      if (!session?.practiceDefinitionId) throw Object.assign(new Error("not a practice attempt"), { status: 404 });
      return session;
    },
    getPracticeAttemptItems: async () => ({ items: [] }),
    getAssessmentSession: async (id) => {
      calls.getSession.push(id);
      if (id === SOURCE_ID) return current.sourceRecord;
      const attempt = current.sessions.find((entry) => entry.id === id);
      if (!attempt) throw Object.assign(new Error("not found"), { status: 404 });
      return attempt;
    },
    listAssessmentItems: async () => ({ items: [] }),
    getAssessmentReport: async (id) => {
      calls.getReport.push(id);
      return current.reportRecord;
    },
    createAssessmentRemediation: async (sourceSessionId) => {
      calls.post.push(sourceSessionId);
      return { outcome: "CREATED", sourceSessionId, attemptId: "remediation-server-id", status: "CREATED", itemCount: 1, resumed: false };
    },
    ...overrides,
  };
  const context = {
    document: { querySelector: () => app },
    YuzanApi: api,
    window: {
      sessionStorage,
      addEventListener(name, callback) { windowListeners[name] = callback; },
    },
    location: {},
    Date,
    Intl,
    Object,
    console,
  };
  vm.runInNewContext(source, context);
  return { app, api, calls, context, current, identity, sessionStorage, statusNodes, storage, windowListeners };
}

function actionButton(kind, sourceSessionId = SOURCE_ID, attemptId = "") {
  const attribute = {
    create: "[data-growth-remediation]",
    verify: "[data-growth-verify]",
    resume: "[data-growth-resume]",
    refresh: "[data-growth-refresh]",
  }[kind];
  return {
    dataset: { sourceSessionId, attemptId },
    disabled: false,
    attributes: new Map(),
    matches(selector) { return selector === attribute; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  };
}

async function click(view, kind, sourceSessionId = SOURCE_ID, attemptId = "") {
  const button = actionButton(kind, sourceSessionId, attemptId);
  const result = view.app.listeners.click({ target: { closest: () => button } });
  if (result?.then) await result;
  await flush();
}

test("T025: empty Growth data has no score, report action, or invented practice", async () => {
  const view = mount({ historySessions: [], sourceRecord: null, reportRecord: null });
  await flush();
  assert.match(view.app.innerHTML, /没有已完成的正式测评记录/);
  assert.match(view.app.innerHTML, /没有开放的练习/);
  assert.doesNotMatch(view.app.innerHTML, /0 分|data-growth-remediation|推荐练习/);
});

test("T025: a completed linked formal report shows real feedback, candidate content, source IDs, and a scoped action", async () => {
  const view = mount();
  await flush();
  assert.match(view.app.innerHTML, /72 分/);
  assert.match(view.app.innerHTML, /正式测评教师评语 · 人工复核/);
  assert.match(view.app.innerHTML, /朗读清楚，请继续练习自然停顿。/);
  assert.match(view.app.innerHTML, /question-version-a|句子理解/);
  assert.match(view.app.innerHTML, /AssessmentReport formal-report-a/);
  assert.match(view.app.innerHTML, /AssessmentSession assessment-source-a/);
  assert.ok(view.calls.listSessionEnrollmentIds.every((enrollmentId) => enrollmentId === "enrollment-a"));
  assert.match(view.app.innerHTML, /针对本次报告继续巩固/);
  assert.doesNotMatch(view.app.innerHTML, /private-reviewer-a|private-rubric|private-answer|scoringSpec/);
});

test("T077: one report read failure keeps other formal reports visible and offers recovery", async () => {
  const secondSessionId = "assessment-source-b";
  const historySessions = [
    { sessionId: SOURCE_ID, purpose: "STANDARD", type: "MIXED", completedAt: formalSource().completedAt },
    { sessionId: secondSessionId, purpose: "STANDARD", type: "READING", completedAt: formalSource().completedAt },
  ];
  const reportFailure = Object.assign(new Error("report service unavailable"), { status: 503 });
  const view = mount({
    historySessions,
    overrides: {
      getAssessmentSession: async (id) => formalSource({ id }),
      getAssessmentReport: async (id) => {
        if (id === secondSessionId) throw reportFailure;
        return formalReport();
      },
    },
  });

  await flush();

  assert.match(view.app.innerHTML, /72 分/);
  assert.match(view.app.innerHTML, /正式报告/);
  assert.match(view.app.innerHTML, /暂时无法读取/);
  assert.match(view.app.innerHTML, /data-growth-refresh/);
  assert.match(view.app.innerHTML, /report service unavailable/);
  await click(view, "refresh");
  assert.equal(view.calls.listSessions, 2, "Retry should reload current server data");
});

test("T077: blank retry candidate versions do not expose a remediation action", async () => {
  const view = mount({
    reportRecord: formalReport({
      diagnosis: { retryCandidates: [{ questionVersionId: "  ", displayName: "版本缺失题目" }] },
    }),
  });

  await flush();

  assert.match(view.app.innerHTML, /缺少可核实的题目版本关联/);
  assert.doesNotMatch(view.app.innerHTML, /data-growth-remediation/);
});

test("T077: a capped report list says older reports are available in full history", async () => {
  const historySessions = Array.from({ length: 9 }, (_, index) => ({
    sessionId: `assessment-source-${index + 1}`,
    purpose: "STANDARD",
    type: "MIXED",
    completedAt: formalSource().completedAt,
  }));
  const requestedReportIds = [];
  const view = mount({
    historySessions,
    overrides: {
      getAssessmentSession: async (id) => formalSource({ id }),
      getAssessmentReport: async (id) => {
        requestedReportIds.push(id);
        return formalReport({ id: `report-${id}`, sessionId: id });
      },
    },
  });

  await flush();

  assert.equal(requestedReportIds.length, 8);
  assert.equal(requestedReportIds.includes("assessment-source-9"), false);
  assert.match(view.app.innerHTML, /这里只显示最近 8 条正式测评/);
  assert.match(view.app.innerHTML, /查看完整学习历史/);
});

test("T025: zero and absent official scores remain different states", async () => {
  const zero = mount({ reportRecord: formalReport({ overallScore: 0 }) });
  await flush();
  assert.match(zero.app.innerHTML, /0 分/);

  const absent = mount({ reportRecord: formalReport({ overallScore: null }) });
  await flush();
  assert.match(absent.app.innerHTML, /暂无正式得分/);
  assert.doesNotMatch(absent.app.innerHTML, /<span>0 分<\/span>/);
});

test("T025: only a completed, fully linked, complete report can expose an official score or retry action", async (t) => {
  const rejectsFormalReport = async (view, score) => {
    await flush();
    assert.doesNotMatch(view.app.innerHTML, new RegExp(`${score} 分|data-growth-remediation`));
  };

  await t.test("IN_PROGRESS source with an otherwise complete fake report", async () => {
    const view = mount({
      sourceRecord: formalSource({ status: "IN_PROGRESS", completedAt: null }),
      reportRecord: formalReport({ overallScore: 91 }),
    });
    await rejectsFormalReport(view, 91);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("PROCESSING source with an otherwise complete fake report", async () => {
    const view = mount({
      sourceRecord: formalSource({ status: "PROCESSING", completedAt: null }),
      reportRecord: formalReport({ overallScore: 90 }),
    });
    await rejectsFormalReport(view, 90);
    assert.match(view.app.innerHTML, /等待教师复核/);
  });
  await t.test("completed report still awaiting teacher review", async () => {
    const view = mount({
      reportRecord: formalReport({
        overallScore: 89,
        summary: { scoringState: "NEEDS_REVIEW", requiresTeacherReview: true },
      }),
    });
    await rejectsFormalReport(view, 89);
    assert.match(view.app.innerHTML, /等待教师复核/);
  });
  await t.test("score outside the formal 0–100 range", async () => {
    const view = mount({ reportRecord: formalReport({ overallScore: 101 }) });
    await rejectsFormalReport(view, 101);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("source Session belongs to a different school", async () => {
    const view = mount({ sourceRecord: formalSource({ schoolId: "school-b" }), reportRecord: formalReport({ overallScore: 88 }) });
    await rejectsFormalReport(view, 88);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("source Session belongs to a different enrollment", async () => {
    const view = mount({ sourceRecord: formalSource({ enrollmentId: "enrollment-b" }), reportRecord: formalReport({ overallScore: 87 }) });
    await rejectsFormalReport(view, 87);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("Report belongs to a different school", async () => {
    const view = mount({ reportRecord: formalReport({ schoolId: "school-b", overallScore: 86 }) });
    await rejectsFormalReport(view, 86);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("Report points at a different Session ID", async () => {
    const view = mount({ reportRecord: formalReport({ sessionId: "other-session", overallScore: 85 }) });
    await rejectsFormalReport(view, 85);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("source response points at a different Session ID", async () => {
    const view = mount({ sourceRecord: formalSource({ id: "other-session" }), reportRecord: formalReport({ overallScore: 84 }) });
    await rejectsFormalReport(view, 84);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("99 percent complete report", async () => {
    const view = mount({ reportRecord: formalReport({ dataCompleteness: 99, overallScore: 66 }) });
    await rejectsFormalReport(view, 66);
    assert.match(view.app.innerHTML, /数据尚未完整/);
  });
  await t.test("null completeness and missing generated time", async () => {
    const incomplete = mount({ reportRecord: formalReport({ dataCompleteness: null, overallScore: 65 }) });
    const noGenerationTime = mount({ reportRecord: formalReport({ generatedAt: null, overallScore: 64 }) });
    await rejectsFormalReport(incomplete, 65);
    await rejectsFormalReport(noGenerationTime, 64);
    assert.match(incomplete.app.innerHTML, /数据尚未完整/);
    assert.match(noGenerationTime.app.innerHTML, /数据尚未完整/);
  });
});

test("T025: published Submission feedback is visibly separate from AssessmentReport comments", async () => {
  const view = mount({ events: [{
    id: "feedback-record-a",
    type: "FEEDBACK",
    title: "需要改进",
    description: "请补充朗读练习。",
    timestamp: "2026-10-18T10:00:00.000Z",
    actorUserId: "private-teacher-id",
  }] });
  await flush();
  assert.match(view.app.innerHTML, /课程任务教师反馈/);
  assert.match(view.app.innerHTML, /课程任务 · 已发布/);
  assert.match(view.app.innerHTML, /Feedback feedback-record-a/);
  assert.match(view.app.innerHTML, /请补充朗读练习/);
  assert.match(view.app.innerHTML, /正式测评教师评语 · 人工复核/);
  assert.doesNotMatch(view.app.innerHTML, /private-teacher-id/);
});

test("T025: a late history response from the previous school is discarded", async () => {
  let releaseOldHistory;
  let historyCalls = 0;
  const oldHistory = new Promise((resolve) => { releaseOldHistory = resolve; });
  const view = mount({ overrides: {
    getAssessmentHistory: async () => {
      historyCalls += 1;
      if (historyCalls === 1) return oldHistory;
      return { enrollmentId: "enrollment-b", sessions: [] };
    },
  } });

  await flush();
  assert.equal(historyCalls, 1);
  view.identity.schoolId = "school-b";
  view.current.enrollmentId = "enrollment-b";
  view.windowListeners.storage({ key: "yuzan-active-school-id" });
  await flush();
  await flush();
  assert.match(view.app.innerHTML, /学校school-b/);
  assert.doesNotMatch(view.app.innerHTML, /72 分|assessment-source-a/);

  releaseOldHistory({ enrollmentId: "enrollment-a", sessions: [{ sessionId: SOURCE_ID, purpose: "STANDARD" }] });
  await flush();
  await flush();
  assert.match(view.app.innerHTML, /学校school-b/);
  assert.doesNotMatch(view.app.innerHTML, /72 分|朗读清楚，请继续练习自然停顿。|assessment-source-a/);
});

test("T025: double click creates once, verifies the returned session relation, and routes by its real ID", async () => {
  const view = mount({ overrides: {
    createAssessmentRemediation: async (sourceSessionId) => {
      view.calls.post.push(sourceSessionId);
      return { outcome: "CREATED", sourceSessionId, attemptId: "remediation-server-id", status: "CREATED", itemCount: 1, resumed: false };
    },
  } });
  await flush();
  view.api.getAssessmentSession = async (id) => {
    view.calls.getSession.push(id);
    if (id === SOURCE_ID) return view.current.sourceRecord;
    if (id === "remediation-server-id") return {
      id,
      schoolId: "school-a",
      enrollmentId: "enrollment-a",
      purpose: "REMEDIATION",
      retestOfSessionId: SOURCE_ID,
      status: "IN_PROGRESS",
    };
    throw Object.assign(new Error("not found"), { status: 404 });
  };
  const first = view.app.listeners.click({ target: { closest: () => actionButton("create") } });
  const second = view.app.listeners.click({ target: { closest: () => actionButton("create") } });
  await Promise.all([first, second]);
  assert.deepEqual(view.calls.post, [SOURCE_ID]);
  assert.ok(view.calls.getSession.includes("remediation-server-id"));
  assert.equal(view.context.location.href, "/student/practices/attempts/remediation-server-id/runner/");
});

test("T025: unknown POST outcome is recovered with GET only and stays pending across refresh", async () => {
  const storage = new Map();
  let postCount = 0;
  const overrides = {
    createAssessmentRemediation: async () => { postCount += 1; throw new TypeError("offline after request"); },
  };
  const first = mount({ overrides, storage });
  await flush();
  await click(first, "create");
  assert.equal(postCount, 1);
  assert.match(first.statusNodes.get(SOURCE_ID).innerHTML, /创建状态待核实/);
  await click(first, "verify");
  assert.equal(postCount, 1);

  const afterRefresh = mount({ overrides, storage });
  await flush();
  assert.match(afterRefresh.app.innerHTML, /创建状态待核实/);
  await click(afterRefresh, "verify");
  assert.equal(postCount, 1);
  assert.match(afterRefresh.statusNodes.get(SOURCE_ID).innerHTML, /没有再次发送创建请求/);
});

test("T025: when retry state cannot be persisted, the client does not send a create request", async () => {
  const view = mount();
  await flush();
  view.context.window.sessionStorage = undefined;
  await click(view, "create");
  assert.equal(view.calls.post.length, 0);
  assert.match(view.statusNodes.get(SOURCE_ID).innerHTML, /无法保存创建状态/);
  assert.doesNotMatch(view.statusNodes.get(SOURCE_ID).innerHTML, /已创建/);
});

test("T025: if the server committed before a lost response, the student recovers and opens that session", async () => {
  const serverSessions = [];
  let postCount = 0;
  const view = mount({ overrides: {
    listAssessmentSessions: async () => ({ items: serverSessions, nextCursor: null, hasMore: false }),
    createAssessmentRemediation: async (sourceSessionId) => {
      postCount += 1;
      serverSessions.push({ id: "remediation-committed-id", purpose: "REMEDIATION", retestOfSessionId: sourceSessionId, status: "CREATED", schoolId: "school-a", enrollmentId: "enrollment-a", createdAt: "2026-10-18T10:00:00.000Z" });
      throw new TypeError("response lost");
    },
    getAssessmentSession: async (id) => {
      if (id === SOURCE_ID) return formalSource();
      return serverSessions.find((entry) => entry.id === id);
    },
  } });
  await flush();
  await click(view, "create");
  assert.equal(postCount, 1);
  assert.equal(view.context.location.href, "/student/practices/attempts/remediation-committed-id/runner/");
});

test("T025: an existing related session resumes by its returned ID and never posts again", async () => {
  const remediation = { id: "existing-remediation-id", purpose: "REMEDIATION", retestOfSessionId: SOURCE_ID, status: "PROCESSING", schoolId: "school-a", enrollmentId: "enrollment-a", createdAt: "2026-10-18T10:00:00.000Z" };
  const view = mount({ sessions: [remediation] });
  await flush();
  assert.match(view.app.innerHTML, /正在处理/);
  await click(view, "resume", SOURCE_ID, remediation.id);
  assert.equal(view.calls.post.length, 0);
  assert.equal(view.context.location.href, "/student/practices/attempts/existing-remediation-id/processing/");
});

test("T025: server conflicts show the returned reason and never claim success", async () => {
  const conflict = Object.assign(new Error("该测评没有可用于巩固练习的正式题库诊断"), { status: 409 });
  const view = mount({ overrides: { createAssessmentRemediation: async () => { throw conflict; } } });
  await flush();
  await click(view, "create");
  assert.match(view.statusNodes.get(SOURCE_ID).innerHTML, /该测评没有可用于巩固练习的正式题库诊断/);
  assert.doesNotMatch(view.statusNodes.get(SOURCE_ID).innerHTML, /已创建|开始巩固/);
});

test("T025: open practice status and destinations use server practice and Attempt IDs", async () => {
  const view = mount({
    sessions: [{ id: "open-practice-attempt-id", status: "PROCESSING", purpose: "STANDARD", practiceDefinitionId: "open-practice-definition-id", createdAt: "2026-10-18T09:00:00.000Z" }],
    practices: [{ id: "open-practice-definition-id", title: "服务端开放练习", summary: "当前可参加", mode: "SELF_PRACTICE", catalogType: "SPECIALIZED" }],
    overrides: {
      getPracticeAttempt: async (id) => ({ id, practiceDefinitionId: "open-practice-definition-id", status: "PROCESSING" }),
    },
  });
  await flush();
  assert.match(view.app.innerHTML, /服务端开放练习/);
  assert.match(view.app.innerHTML, /查看状态/);
  assert.match(view.app.innerHTML, /student\/practices\/attempts\/open-practice-attempt-id\/processing/);
  assert.match(view.app.innerHTML, /data-practice-definition-id="open-practice-definition-id"/);
});
