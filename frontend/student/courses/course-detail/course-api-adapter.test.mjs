import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const adapterSource = fs.readFileSync(
  new URL("./course-api-adapter.js", import.meta.url),
  "utf8",
);

function loadAdapter(apiOverrides = {}) {
  const saved = new Map();
  const calls = [];
  const api = {
    getStudentCourse: async () => ({}),
    createOrResumeCourseSubmission: async () => ({}),
    createOrResumePractice: async (definitionId, context) => {
      calls.push({ definitionId, context });
      return { attemptId: "attempt-1", status: "CREATED", resumed: false };
    },
    ...apiOverrides,
  };
  const location = {
    origin: "http://127.0.0.1:4175",
    pathname: "/student/courses/course-detail/",
    search: "?id=assignment-1&activityId=activity-1",
    href: "http://127.0.0.1:4175/student/courses/course-detail/?id=assignment-1&activityId=activity-1",
  };
  const localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
    removeItem: (key) => saved.delete(key),
  };
  const window = { YuzanApi: api, location, localStorage };
  vm.runInNewContext(adapterSource, {
    window,
    URL,
    URLSearchParams,
    TypeError,
    Error,
    Date,
    Math,
  });
  return { adapter: window.CourseApiAdapter, calls, saved, location };
}

test("normalizes the current nested course aggregate without dropping activity facts", async () => {
  const raw = {
    assignment: { id: "assignment-1", title: "春日课程" },
    course: { id: "course-1", title: "古诗文" },
    courseVersion: {
      id: "version-1",
      title: "古诗文朗读与理解训练",
      description: "真实课程说明",
      gradeBand: "五年级",
      capabilityTheme: "朗读与理解",
      difficulty: "基础",
      estimatedMinutes: 35,
      coverAsset: "/assets/course.webp",
      objectives: ["准确朗读"],
    },
    units: [{
      id: "unit-1",
      title: "第一单元",
      sortOrder: 1,
      lessons: [{
        id: "lesson-1",
        title: "春晓",
        sortOrder: 1,
        activities: [{
          id: "activity-1",
          type: "PRACTICE",
          title: "朗读与理解训练",
          instruction: "先朗读，再作答",
          content: { passage: "春眠不觉晓" },
          resources: [{ purpose: "AUDIO", resource: { id: "resource-1" } }],
          progress: { completed: true, revision: 3, position: 1 },
          attempt: { id: "activity-attempt-1", kind: "COURSE_PRACTICE" },
          practiceReference: {
            practiceDefinitionId: "definition-1",
            title: "春晓综合练习",
            required: true,
          },
        }],
      }],
    }],
    studentProgress: {
      progressPercent: 100,
      completedRequiredCount: 1,
      requiredActivityCount: 1,
      attainmentStatus: "PENDING",
    },
    existingSubmission: {
      id: "submission-1",
      status: "IN_PROGRESS",
      revision: 4,
    },
  };
  const { adapter } = loadAdapter({ getStudentCourse: async () => raw });

  const course = await adapter.loadCourse("assignment-1");
  const activity = course.units[0].lessons[0].activities[0];

  assert.equal(course.assignmentId, "assignment-1");
  assert.equal(course.courseVersionId, "version-1");
  assert.equal(course.title, "古诗文朗读与理解训练");
  assert.equal(course.progress.percent, 100);
  assert.deepEqual(
    { id: course.submissionId, status: course.submissionStatus, revision: course.submissionRevision },
    { id: "submission-1", status: "IN_PROGRESS", revision: 4 },
  );
  assert.equal(activity.instruction, "先朗读，再作答");
  assert.equal(activity.content.passage, "春眠不觉晓");
  assert.equal(activity.resources[0].resource.id, "resource-1");
  assert.equal(activity.progress.revision, 3);
  assert.equal(activity.attempt.kind, "COURSE_PRACTICE");
  assert.equal(activity.practiceReference.practiceDefinitionId, "definition-1");
  assert.equal(activity.isCompleted, true);
});

test("does not invent zero progress or promote a page-local completion flag", async () => {
  const { adapter } = loadAdapter({
    getStudentCourse: async () => ({
      assignment: { id: "assignment-1" },
      course: { id: "course-1" },
      courseVersion: { id: "version-1", title: "Server course" },
      units: [{
        id: "unit-1",
        title: "Unit 1",
        lessons: [{
          id: "lesson-1",
          title: "Lesson 1",
          activities: [{
            id: "activity-1",
            type: "TEXT",
            title: "Read",
            instruction: { originalText: "Read this" },
            isCompleted: true,
            progress: { completed: false, revision: 0, position: 0 },
          }],
        }],
      }],
      studentProgress: {
        progressPercent: 0,
        completedRequiredCount: 0,
        requiredActivityCount: 1,
        completedActivityIds: [],
      },
    }),
  });

  const course = await adapter.loadCourse("assignment-1");
  const activity = course.units[0].lessons[0].activities[0];
  assert.equal(course.progress.percent, 0);
  assert.equal(course.progress.completedActivities, 0);
  assert.equal(activity.instruction, "Read this");
  assert.equal(activity.isCompleted, false);

  const { adapter: noProgressAdapter } = loadAdapter({
    getStudentCourse: async () => ({ assignment: { id: "assignment-1" }, units: [] }),
  });
  const noProgressCourse = await noProgressAdapter.loadCourse("assignment-1");
  assert.equal(noProgressCourse.progress.percent, null);
  assert.equal(noProgressCourse.progress.completedActivities, null);
});

test("preserves the wrapped submission id, status, revision and resumed flag", async () => {
  const { adapter } = loadAdapter({
    createOrResumeCourseSubmission: async () => ({
      submission: { id: "submission-1", status: "IN_PROGRESS", revision: 7 },
      resumed: true,
    }),
  });

  const submission = await adapter.createSubmission("assignment-1");
  assert.equal(submission.id, "submission-1");
  assert.equal(submission.submissionId, "submission-1");
  assert.equal(submission.status, "IN_PROGRESS");
  assert.equal(submission.revision, 7);
  assert.equal(submission.resumed, true);
});

test("normalizes the formal course submission response instead of guessing from the request", async () => {
  const { adapter } = loadAdapter({
    submitStudentCourse: async (_assignmentId, _submissionId, revision) => ({
      submission: { id: "submission-1", status: "SUBMITTED", revision: revision + 1, submittedAt: "2026-10-20T00:00:00Z" },
      courseCompletion: { progressPercent: 100, completedRequiredCount: 2, requiredActivityCount: 2 },
    }),
  });

  const result = await adapter.submitCourse("assignment-1", "submission-1", 4);
  assert.equal(result.id, "submission-1");
  assert.equal(result.status, "SUBMITTED");
  assert.equal(result.revision, 5);
  assert.equal(result.courseCompletion.progressPercent, 100);
});

test("does not fill missing dashboard counters or weekly goals with display defaults", async () => {
  const { adapter } = loadAdapter({
    getStudentCoursesDashboard: async () => ({ totalLearningMinutes: 0, consecutiveDays: 0 }),
  });

  const dashboard = await adapter.loadDashboard();
  assert.equal(dashboard.totalMinutes, null);
  assert.equal(dashboard.consecutiveDays, 0);
  assert.equal(dashboard.weeklyMinutes, null);
  assert.equal(dashboard.weeklyGoalHours, null);
  assert.equal(dashboard.coursesLearned, null);
  assert.equal(dashboard.recentDays, null);
});

test("propagates permission and network failures instead of returning success-shaped data", async () => {
  const forbidden = Object.assign(new Error("forbidden"), { status: 403, code: "FORBIDDEN" });
  const { adapter } = loadAdapter({ getStudentCourse: async () => { throw forbidden; } });

  await assert.rejects(
    adapter.loadCourse("assignment-1"),
    (error) => error.status === 403 && error.code === "FORBIDDEN",
  );
});

test("preserves 403 when an authorized media URL cannot be issued", async () => {
  const forbidden = Object.assign(new Error("resource access denied"), { status: 403, code: "FORBIDDEN" });
  const { adapter } = loadAdapter({ getResourcePlaybackUrl: async () => { throw forbidden; } });

  await assert.rejects(
    adapter.getResourcePlaybackUrl("resource-1"),
    (error) => error.status === 403 && error.code === "FORBIDDEN",
  );
});

test("creates a course attempt with all three IDs and stores a safe return context", async () => {
  const { adapter, calls, saved } = loadAdapter();

  const result = await adapter.startCoursePractice({
    assignmentId: "assignment-1",
    submissionId: "submission-1",
    activityId: "activity-1",
    practiceDefinitionId: "definition-1",
    returnTo: "/student/courses/course-detail/?id=assignment-1&activityId=activity-1",
  });

  assert.equal(calls[0].definitionId, "definition-1");
  assert.equal(calls[0].context.assignmentId, "assignment-1");
  assert.equal(calls[0].context.submissionId, "submission-1");
  assert.equal(calls[0].context.activityId, "activity-1");
  assert.equal(result.attemptId, "attempt-1");
  assert.equal(result.navigateTo, "/student/practices/attempts/attempt-1/prepare/");
  const context = JSON.parse(saved.get("yuzan-course-practice-context:attempt-1"));
  assert.equal(context.returnTo, "/student/courses/course-detail/?id=assignment-1&activityId=activity-1");
  assert.equal(context.syncStatus, "PENDING");
});

test("refuses missing IDs and external return targets before creating an attempt", async () => {
  const { adapter, calls } = loadAdapter();
  await assert.rejects(
    adapter.startCoursePractice({
      assignmentId: "assignment-1",
      submissionId: "",
      activityId: "activity-1",
      practiceDefinitionId: "definition-1",
      returnTo: "/student/courses/course-detail/?id=assignment-1",
    }),
    /assignmentId.*submissionId.*activityId/,
  );
  await assert.rejects(
    adapter.startCoursePractice({
      assignmentId: "assignment-1",
      submissionId: "submission-1",
      activityId: "activity-1",
      practiceDefinitionId: "definition-1",
      returnTo: "https://example.invalid/steal",
    }),
    /returnTo/,
  );
  assert.equal(calls.length, 0);
});
