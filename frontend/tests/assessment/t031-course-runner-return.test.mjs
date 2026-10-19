import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const apiSource = fs.readFileSync(new URL("../../assets/api-client.js", import.meta.url), "utf8");
const runnerSource = fs.readFileSync(new URL("../../assessment/assets/runner.js", import.meta.url), "utf8");

const ids = {
  attemptId: "attempt-1",
  assignmentId: "assignment-1",
  submissionId: "submission-1",
  activityId: "activity-1",
  enrollmentId: "enrollment-1",
  schoolId: "school-1",
  userId: "student-1",
};

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function loadApi(fetchImpl, { returnTo, userId = ids.userId, progress = null, sessionStatus = "IN_PROGRESS", courseContext = {} } = {}) {
  const context = {
    ...ids,
    returnTo: returnTo ?? `/student/courses/course-detail/?id=${ids.assignmentId}&activityId=${ids.activityId}&submissionId=${ids.submissionId}`,
    ...courseContext,
  };
  const values = new Map([
    ["yuzan-access-token", "test-token"],
    ["yuzan-active-school-id", ids.schoolId],
    ["yuzan-current-user", JSON.stringify({ id: userId })],
    [`yuzan-course-practice-context:${ids.attemptId}`, JSON.stringify(context)],
  ]);
  const localStorage = {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  const location = {
    origin: "http://127.0.0.1:4175",
    href: "http://127.0.0.1:4175/student/practices/attempts/attempt-1/runner/",
    assignments: [],
    assign(url) { this.assignments.push(url); this.href = url; },
  };
  const window = {};
  vm.runInNewContext(apiSource, {
    window,
    localStorage,
    location,
    fetch: fetchImpl,
    URL,
    URLSearchParams,
    Headers,
    Blob,
    FormData,
    Date,
    Error,
    console,
    setTimeout,
    clearTimeout,
  });
  return { api: window.YuzanApi, values, location, context, progress, sessionStatus };
}

function makeFetch({
  initialStatus = "IN_PROGRESS",
  initiallyCompleted = false,
  completeMode = "success",
  rejectStatus,
  wrongActivity = false,
} = {}) {
  const state = {
    sessionStatus: initialStatus,
    progress: initiallyCompleted ? { activityId: ids.activityId, enrollmentId: ids.enrollmentId, completed: true, revision: 1 } : null,
    completeMode,
    submitPosts: 0,
    completionPosts: 0,
    requests: [],
    rejectStatus,
  };
  const fetch = async (url, options = {}) => {
    const method = String(options.method || "GET").toUpperCase();
    state.requests.push({ url: String(url), method });
    if (state.rejectStatus && method === "GET" && String(url).includes("/assessments/sessions/")) {
      return response(state.rejectStatus, { error: { code: `HTTP_${state.rejectStatus}`, message: "blocked" } });
    }
    if (String(url).includes("/assessments/sessions/attempt-1")) {
      if (String(url).endsWith("/submit") && method === "POST") {
        state.submitPosts += 1;
        state.sessionStatus = "PROCESSING";
        return response(201, { data: { id: ids.attemptId, status: state.sessionStatus, enrollmentId: ids.enrollmentId, schoolId: ids.schoolId } });
      }
      return response(200, { data: { id: ids.attemptId, status: state.sessionStatus, enrollmentId: ids.enrollmentId, schoolId: ids.schoolId } });
    }
    if (String(url).includes("/practices/attempts/attempt-1")) {
      return response(200, { data: { id: ids.attemptId, status: state.sessionStatus, enrollmentId: ids.enrollmentId, schoolId: ids.schoolId, courseSubmissionId: ids.submissionId, courseActivityId: wrongActivity ? "other-activity" : ids.activityId } });
    }
    if (String(url).includes(`/learning/activities/${ids.activityId}/progress`)) {
      return response(200, { data: state.progress });
    }
    if (String(url).endsWith(`/practice-attempts/${ids.attemptId}/complete`) && method === "POST") {
      state.completionPosts += 1;
      if (state.completeMode === "failure") return response(503, { error: { code: "PROVIDER_UNAVAILABLE", message: "offline" } });
      if (state.completeMode === "dropped-response") {
        state.progress = { activityId: ids.activityId, enrollmentId: ids.enrollmentId, completed: true, revision: 1 };
        throw new TypeError("Failed to fetch after server commit");
      }
      state.progress = { activityId: ids.activityId, enrollmentId: ids.enrollmentId, completed: true, revision: 1 };
      return response(201, { data: { practiceAttemptId: ids.attemptId, synced: true } });
    }
    if (String(url).endsWith(`/student/courses/${ids.assignmentId}`)) {
      return response(200, { data: {
        assignment: { id: ids.assignmentId },
        existingSubmission: { id: ids.submissionId },
        units: [{ lessons: [{ activities: [{ id: ids.activityId }] }] }],
      } });
    }
    return response(404, { error: { code: "NOT_FOUND", message: "not found" } });
  };
  return { fetch, state };
}

test("Runner uses one navigation owner and the API returns server-confirmed course destination", async () => {
  const backend = makeFetch();
  const { api, location, values } = loadApi(backend.fetch);
  const result = await api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true });

  assert.equal(backend.state.submitPosts, 1);
  assert.equal(backend.state.completionPosts, 1);
  assert.equal(result.courseSync.linked, true);
  assert.equal(result.courseSync.serverConfirmed, true);
  assert.equal(result.courseSync.activityProgress.completed, true);
  assert.equal(result.courseSync.navigateTo, `/student/courses/course-detail/?id=${ids.assignmentId}&activityId=${ids.activityId}&submissionId=${ids.submissionId}&practiceAttemptId=${ids.attemptId}`);
  assert.equal(location.assignments.length, 0);
  assert.equal(location.href, "http://127.0.0.1:4175/student/practices/attempts/attempt-1/runner/");
  assert.equal(JSON.parse(values.get(`yuzan-course-practice-context:${ids.attemptId}`)).syncStatus, "COMPLETED");
  assert.equal(backend.state.requests.filter(item => item.method === "GET" && item.url.includes("/assessments/sessions/attempt-1")).length, 3);
});

test("a submit 201 followed by course-sync outage stays pending and retries the same attempt only", async () => {
  const backend = makeFetch({ completeMode: "failure" });
  const { api, values } = loadApi(backend.fetch);
  const first = await api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true });

  assert.equal(first.courseSync.pending, true);
  assert.equal(first.courseSync.submitted, true);
  assert.equal(first.courseSync.message, "练习已交卷，课程同步待核实");
  assert.equal(JSON.parse(values.get(`yuzan-course-practice-context:${ids.attemptId}`)).syncStatus, "PENDING");
  assert.equal(backend.state.submitPosts, 1);
  assert.equal(backend.state.completionPosts, 1);

  backend.state.completeMode = "success";
  const retried = await api.retryCoursePracticeCompletion(ids.attemptId, { navigate: false, verifyServer: true });
  assert.equal(retried.linked, true);
  assert.equal(retried.serverConfirmed, true);
  assert.equal(backend.state.submitPosts, 1);
  assert.equal(backend.state.completionPosts, 2);
});

test("a committed course completion with a dropped 201 response is reconciled by GET without a duplicate POST", async () => {
  const backend = makeFetch({ completeMode: "dropped-response" });
  const { api } = loadApi(backend.fetch);
  const result = await api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true });

  assert.equal(result.courseSync.linked, true);
  assert.equal(result.courseSync.reconciledAfterLostResponse, true);
  assert.equal(result.courseSync.activityProgress.completed, true);
  assert.equal(backend.state.submitPosts, 1);
  assert.equal(backend.state.completionPosts, 1);
});

test("refresh reconciliation skips submit and course-complete POSTs when server progress is already complete", async () => {
  const backend = makeFetch({ initialStatus: "PROCESSING", initiallyCompleted: true });
  const { api } = loadApi(backend.fetch, { sessionStatus: "PROCESSING", progress: true });
  const result = await api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true });

  assert.equal(result.courseSync.linked, true);
  assert.equal(result.courseSync.alreadyCompleted, true);
  assert.equal(backend.state.submitPosts, 0);
  assert.equal(backend.state.completionPosts, 0);
});

test("safe return target requires same-origin exact CourseDetail path and matching dynamic IDs", () => {
  const backend = makeFetch();
  const valid = loadApi(backend.fetch);
  assert.equal(valid.api.getCoursePracticeReturnTo(ids.attemptId), `/student/courses/course-detail/?id=${ids.assignmentId}&activityId=${ids.activityId}&submissionId=${ids.submissionId}&practiceAttemptId=${ids.attemptId}`);

  const invalidTargets = [
    "https://outside.example/steal",
    "//outside.example/steal",
    "/student/practices/",
    `/student/courses/course-detail/?id=other&activityId=${ids.activityId}&submissionId=${ids.submissionId}`,
    `/student/courses/course-detail/?id=${ids.assignmentId}&activityId=${ids.activityId}&submissionId=other`,
    `/student/courses/course-detail/?id=${ids.assignmentId}&id=other&activityId=${ids.activityId}&submissionId=${ids.submissionId}`,
    `/student/courses/course-detail/?id=${ids.assignmentId}&activityId=${ids.activityId}&submissionId=${ids.submissionId}&practiceAttemptId=other`,
  ];
  for (const returnTo of invalidTargets) {
    const candidate = loadApi(backend.fetch, { returnTo });
    assert.equal(candidate.api.getCoursePracticeReturnTo(ids.attemptId), "/student/courses/", returnTo);
  }
});

test("401, 403, and 404 access failures clear stale context and cached identity; 409 keeps recovery context", async () => {
  for (const status of [401, 403, 404]) {
    const backend = makeFetch({ rejectStatus: status });
    const { api, values } = loadApi(backend.fetch);
    values.set("yuzan-course-practice-context:attempt-old", JSON.stringify({ assignmentId: "old-assignment" }));
    await assert.rejects(
      api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true }),
      error => error.code === "COURSE_PROGRESS_ACCESS_LOST",
    );
    assert.equal(values.has(`yuzan-course-practice-context:${ids.attemptId}`), false);
    assert.equal(values.has("yuzan-course-practice-context:attempt-old"), false);
    assert.equal(values.has("yuzan-access-token"), false);
    assert.equal(values.has("yuzan-active-school-id"), false);
    assert.equal(backend.state.submitPosts, 0);
  }

  const conflictBackend = makeFetch({ rejectStatus: 409 });
  const conflict = loadApi(conflictBackend.fetch);
  const pending = await conflict.api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true });
  assert.equal(pending.courseSync.pending, true);
  assert.equal(conflict.values.has(`yuzan-course-practice-context:${ids.attemptId}`), true);
  assert.equal(conflictBackend.state.submitPosts, 0);
});

test("changed identity is cleared before any foreign attempt read", async () => {
  const backend = makeFetch();
  const { api, values } = loadApi(backend.fetch, { userId: "student-b" });
  await assert.rejects(
    api.submitAssessmentSession(ids.attemptId, { navigate: false, verifyServer: true }),
    error => error.code === "COURSE_PROGRESS_ACCESS_LOST",
  );
  assert.equal(backend.state.requests.length, 0);
  assert.equal(values.has(`yuzan-course-practice-context:${ids.attemptId}`), false);
  assert.equal(values.has("yuzan-current-user"), false);
});

test("T012 confirmation cancel and Escape remain non-submitting; Runner has safe return and recovery controls", () => {
  assert.match(runnerSource, /data-cancel-submit/);
  assert.match(runnerSource, /event\.key === 'Escape'/);
  assert.match(runnerSource, /if \(state\.submitting\) return/);
  assert.match(runnerSource, /data-retry-course-sync/);
  assert.match(runnerSource, /location\.assign\(state\.courseReturnTo\)/);
  assert.doesNotMatch(runnerSource, /location\.href\s*=/);
});
