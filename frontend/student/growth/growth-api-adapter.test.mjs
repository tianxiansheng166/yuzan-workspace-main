import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("./assets/growth-api-adapter.js", import.meta.url),
  "utf8",
);

function mount(
  overrides = {},
  identity = { userId: "student-1", schoolId: "school-1" },
) {
  const calls = [];
  const completedAt = new Date().toISOString();
  const api = {
    getToken: () => "TEST_FIXTURE_ONLY",
    getActiveSchoolId: () => identity.schoolId,
    getStoredUser: () => ({ id: identity.userId }),
    getStudentProfile: async () => ({
      profile: {
        userId: "student-1",
        displayName: "TEST_FIXTURE_ONLY",
        schoolName: "学校",
        completedActivities: 2,
      },
    }),
    getAssessmentHistory: async (options) => {
      calls.push(["history", options]);
      return {
        enrollmentId: "enrollment-dynamic",
        sessions: [
          {
            sessionId: "session-dynamic",
            purpose: "STANDARD",
            type: "READING",
            completedAt,
          },
        ],
      };
    },
    getQuestionBankProgress: async () => ({
      version: "qb-progress-v1",
      remediation: [],
    }),
    getAssessmentHistoryEvents: async (enrollmentId) => {
      calls.push(["events", enrollmentId]);
      return {
        enrollmentId,
        events: [
          {
            id: "feedback-dynamic",
            type: "FEEDBACK",
            title: "教师反馈",
            description: "真实反馈内容",
            timestamp: completedAt,
          },
        ],
      };
    },
    listPractices: async (filters) => {
      calls.push(["practices", filters]);
      return {
        items: [
          { id: "practice/dynamic", title: "真实练习", summary: "练习说明" },
        ],
      };
    },
    getAssessmentSession: async (sessionId) => {
      calls.push(["session", sessionId]);
      return {
        id: sessionId,
        schoolId: "school-1",
        enrollmentId: "enrollment-dynamic",
        purpose: "STANDARD",
        status: "COMPLETED",
        type: "READING",
        completedAt,
      };
    },
    getAssessmentReport: async (sessionId) => {
      calls.push(["report", sessionId]);
      return {
        id: "report-dynamic",
        sessionId,
        schoolId: "school-1",
        generatedAt: completedAt,
        dataCompleteness: 100,
        overallScore: 77,
      };
    },
    listMyAssessmentRecordings: async () => [
      {
        recordingId: "recording-dynamic",
        sessionId: "session-dynamic",
        recordingStatus: "COMPLETE",
        durationMs: 8000,
        label: "本人录音",
      },
    ],
    getRecordingEvidence: async (recordingId) => {
      calls.push(["recording", recordingId]);
      return {
        id: recordingId,
        downloadUrl: "https://media.example.invalid/signed-audio",
        durationMs: 8000,
      };
    },
    ...overrides,
  };
  const window = { YuzanApi: api, location: { href: "" } };
  vm.runInNewContext(source, {
    window,
    Date,
    Intl,
    Promise,
    Array,
    Object,
    Number,
    String,
    Math,
    Map,
    Set,
  });
  return {
    load: window.YuzanGrowthData.load,
    calls,
    location: window.location,
  };
}

test("Growth maps verified current-school API records without replacing the original view model with samples", async () => {
  const f = mount();
  const data = await f.load();

  assert.equal(data.state, "normal");
  assert.equal(data.studentName, "TEST_FIXTURE_ONLY");
  assert.equal(data.trend.length, 1);
  assert.equal(data.trend[0].score, 77);
  assert.equal(data.trend[0].id, "session-dynamic");
  assert.equal(data.teacherFeedback[0], "真实反馈内容");
  assert.equal(data.audio.url, "https://media.example.invalid/signed-audio");
  assert.equal(data.audio.duration, 8);
  assert.equal(
    data.plan.practiceHref,
    "/student/practices/practice%2Fdynamic/",
  );
  assert.ok(
    f.calls.some(
      (call) => call[0] === "events" && call[1] === "enrollment-dynamic",
    ),
  );
  assert.ok(
    f.calls.some(
      (call) => call[0] === "session" && call[1] === "session-dynamic",
    ),
  );
  assert.ok(
    f.calls.some(
      (call) => call[0] === "recording" && call[1] === "recording-dynamic",
    ),
  );
});

test("Growth rejects a report with a mismatched school or incomplete data", async () => {
  const f = mount({
    getAssessmentSession: async (sessionId) => ({
      id: sessionId,
      schoolId: "other-school",
      enrollmentId: "enrollment-dynamic",
      purpose: "STANDARD",
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    }),
  });
  const data = await f.load();

  assert.equal(data.state, "normal");
  assert.equal(data.trend.length, 0);
  assert.equal(data.audio.url, "https://media.example.invalid/signed-audio");
});

test("Growth does not plot a score from an incomplete formal report", async () => {
  const f = mount({
    getAssessmentReport: async (sessionId) => ({
      id: "report-dynamic",
      sessionId,
      schoolId: "school-1",
      generatedAt: new Date().toISOString(),
      dataCompleteness: 99,
      overallScore: 99,
    }),
  });
  const data = await f.load();

  assert.equal(data.trend.length, 0);
  assert.doesNotMatch(data.summary, /99 分/);
});

test("Growth distinguishes empty data from service failure and redirects missing authentication", async () => {
  const empty = mount({
    getAssessmentHistory: async () => ({
      enrollmentId: "enrollment-dynamic",
      sessions: [],
    }),
    getAssessmentHistoryEvents: async (enrollmentId) => ({
      enrollmentId,
      events: [],
    }),
    getStudentProfile: async () => ({
      profile: { userId: "student-1", completedActivities: 0 },
    }),
    listMyAssessmentRecordings: async () => [],
    listPractices: async () => ({ items: [] }),
  });
  const emptyData = await empty.load();
  assert.equal(emptyData.state, "empty");

  const broken = mount({
    getAssessmentHistory: async () => {
      throw new Error("offline");
    },
  });
  assert.equal((await broken.load()).state, "error");

  const unauthenticated = mount({ getToken: () => "" });
  assert.equal((await unauthenticated.load()).state, "error");
  assert.equal(unauthenticated.location.href, "/login/");
});
