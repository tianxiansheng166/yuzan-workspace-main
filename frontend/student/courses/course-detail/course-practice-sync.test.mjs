import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const apiSource = fs.readFileSync(
  new URL("../../../assets/api-client.js", import.meta.url),
  "utf8",
);

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function loadApi(fetchImpl) {
  const values = new Map([
    ["yuzan-access-token", "test-token"],
    ["yuzan-active-school-id", "school-1"],
    ["yuzan-course-practice-context:attempt-1", JSON.stringify({
      assignmentId: "assignment-1",
      submissionId: "submission-1",
      activityId: "activity-1",
      practiceDefinitionId: "definition-1",
      returnTo: "/student/courses/course-detail/?id=assignment-1&activityId=activity-1",
      syncStatus: "PENDING",
    })],
  ]);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const location = {
    origin: "http://127.0.0.1:4175",
    href: "http://127.0.0.1:4175/student/practices/attempts/attempt-1/submit/",
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
  return { api: window.YuzanApi, values, location };
}

test("submits the session, completes the course activity and clears recovery context", async () => {
  const requests = [];
  const { api, values, location } = loadApi(async (url, options) => {
    requests.push({ url, options });
    return response(200, { data: { status: "SUBMITTED" } });
  });

  const result = await api.submitAssessmentSession("attempt-1");

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /assessments\/sessions\/attempt-1\/submit$/);
  assert.match(requests[1].url, /student\/courses\/assignment-1\/submissions\/submission-1\/activities\/activity-1\/practice-attempts\/attempt-1\/complete$/);
  assert.equal(result.courseSync.linked, true);
  assert.equal(values.has("yuzan-course-practice-context:attempt-1"), false);
  assert.equal(
    location.href,
    "/student/courses/course-detail/?id=assignment-1&activityId=activity-1&practiceAttemptId=attempt-1",
  );
});

test("preserves a pending context after failed course sync and retries only the idempotent write", async () => {
  const requests = [];
  let completionFails = true;
  const { api, values } = loadApi(async (url, options) => {
    requests.push({ url, options });
    if (url.includes("/practice-attempts/") && completionFails) {
      return response(503, { error: { code: "PROVIDER_UNAVAILABLE", message: "temporarily unavailable" } });
    }
    return response(200, { data: { status: "SUBMITTED" } });
  });

  await assert.rejects(
    api.submitAssessmentSession("attempt-1"),
    (error) => error.code === "COURSE_PROGRESS_SYNC_PENDING",
  );
  const pending = JSON.parse(values.get("yuzan-course-practice-context:attempt-1"));
  assert.equal(pending.syncStatus, "PENDING");
  assert.equal(pending.lastSyncError.code, "PROVIDER_UNAVAILABLE");

  completionFails = false;
  const retried = await api.retryCoursePracticeCompletion("attempt-1", { navigate: false });
  assert.equal(retried.linked, true);
  assert.equal(values.has("yuzan-course-practice-context:attempt-1"), false);
  assert.equal(requests.filter((request) => request.url.includes("/submit")).length, 1);
  assert.equal(requests.filter((request) => request.url.includes("/practice-attempts/")).length, 2);
});
