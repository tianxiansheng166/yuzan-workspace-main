import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const stateSource = fs.readFileSync(
  new URL("./course-player-state.js", import.meta.url),
  "utf8",
);

function courseFixture(overrides = {}) {
  return {
    assignmentId: "assignment-1",
    title: "Authorized course",
    progress: {
      percent: 25,
      completedActivities: 1,
      totalActivities: 4,
      attainmentStatus: "PENDING",
      completedActivityIds: ["activity-1"],
      ...overrides.progress,
    },
    existingSubmission: {
      id: "submission-1",
      status: "IN_PROGRESS",
      revision: 0,
      ...overrides.existingSubmission,
    },
    units: [{
      unitId: "unit-1",
      title: "Unit 1",
      lessons: [{
        lessonId: "lesson-1",
        title: "Lesson 1",
        activities: [
          { activityId: "activity-1", title: "Read", activityType: "TEXT", required: true, isCompleted: true, progress: { revision: 1, completed: true, position: 1 } },
          { activityId: "activity-2", title: "Listen", activityType: "AUDIO", required: true, isCompleted: false, progress: { revision: 0, completed: false, position: 0 } },
          { activityId: "activity-3", title: "Speak", activityType: "SPEECH", required: true, isCompleted: false, progress: null },
          { activityId: "activity-4", title: "Optional", activityType: "VIDEO", required: false, isCompleted: false, progress: { revision: 0, completed: false, position: 0 } },
        ],
      }],
    }],
  };
}

function loadPlayer({ search = "?id=assignment-1", loadCourse, loadRecommendations, loadDashboard, saveActivityAttempt, submitCourse } = {}) {
  const calls = { loadCourse: 0, saves: [], submits: 0 };
  const location = {
    origin: "http://127.0.0.1:4175",
    pathname: "/student/courses/course-detail/",
    search,
    href: `http://127.0.0.1:4175/student/courses/course-detail/${search}`,
  };
  const adapter = {
    loadCourse: async (assignmentId) => {
      calls.loadCourse++;
      return loadCourse ? loadCourse(calls.loadCourse, assignmentId) : courseFixture();
    },
    createSubmission: async () => ({ id: "submission-1", status: "IN_PROGRESS", revision: 0, enrollmentId: "enrollment-1" }),
    loadNotes: async () => [],
    loadRecommendations: async (...args) => loadRecommendations ? loadRecommendations(...args) : [],
    loadDashboard: async (...args) => loadDashboard ? loadDashboard(...args) : ({}),
    saveActivityAttempt: async (...args) => {
      calls.saves.push(args);
      return saveActivityAttempt ? saveActivityAttempt(...args) : {
        progress: { revision: 1, completed: false, position: 0.35 },
        courseCompletion: { progressPercent: 25, completedRequiredCount: 1, requiredActivityCount: 4, completedActivityIds: ["activity-1"] },
      };
    },
    submitCourse: async (...args) => {
      calls.submits++;
      return submitCourse ? submitCourse(...args) : { status: "SUBMITTED", revision: 1 };
    },
  };
  const history = {
    replaceState: (_state, _title, nextUrl) => {
      const parsed = new URL(String(nextUrl));
      location.href = parsed.href;
      location.search = parsed.search;
    },
  };
  const window = { CourseApiAdapter: adapter, location, history };
  vm.runInNewContext(stateSource, {
    window,
    CourseApiAdapter: adapter,
    URL,
    URLSearchParams,
    Promise,
    Error,
  });
  return { player: window.CoursePlayerState, calls, location };
}

test("restores the requested activity and chapter after reload, then finds the next incomplete activity", async () => {
  const { player, location } = loadPlayer({ search: "?id=assignment-1&activityId=activity-2" });
  const state = await player.init("assignment-1");

  assert.equal(state.currentActivityId, "activity-2");
  assert.equal(state.currentActivity._unitTitle, "Unit 1");
  assert.equal(state.currentActivity._lessonTitle, "Lesson 1");
  assert.equal(player.getNextActivity().activityId, "activity-3");

  player.setCurrentActivity("activity-1");
  assert.equal(new URL(location.href).searchParams.get("activityId"), "activity-1");
});

test("optional recommendations and statistics failures do not block an authorized course", async () => {
  const forbidden = Object.assign(new Error("optional endpoint denied"), { status: 403 });
  const unavailable = Object.assign(new Error("statistics unavailable"), { status: 503 });
  const { player } = loadPlayer({
    loadRecommendations: async () => { throw forbidden; },
    loadDashboard: async () => { throw unavailable; },
  });

  const state = await player.init("assignment-1");
  assert.equal(state.error, null);
  assert.equal(state.loading, false);
  assert.equal(state.course.assignmentId, "assignment-1");
  assert.equal(state.recommendationsError, "optional endpoint denied");
  assert.equal(state.dashboardError, "statistics unavailable");
});

test("does not turn a requested completion into progress when the server says it is incomplete", async () => {
  const { player, calls } = loadPlayer({
    saveActivityAttempt: async () => ({
      progress: { revision: 1, completed: false, position: 0.2 },
      courseCompletion: { progressPercent: 25, completedRequiredCount: 1, requiredActivityCount: 4, completedActivityIds: ["activity-1"] },
    }),
  });
  await player.init("assignment-1");

  const result = await player.saveActivityAttempt("activity-2", "VIDEO", { videoPosition: 0.2 }, true);
  const current = player.getState();
  const activity = current.course.units[0].lessons[0].activities[1];

  assert.equal(calls.saves.length, 1);
  assert.equal(calls.saves[0][3].videoPosition, 0.2);
  assert.equal(result.progress.completed, false);
  assert.equal(activity.isCompleted, false);
  assert.equal(current.course.progress.percent, 25);
});

test("a 409 reloads server state and waits for a deliberate retry", async () => {
  const conflict = Object.assign(new Error("stale progress"), { status: 409, code: "REVISION_CONFLICT" });
  const { player, calls } = loadPlayer({
    loadCourse: (loadNo) => loadNo === 1 ? courseFixture() : courseFixture({
      progress: { percent: 50, completedActivities: 2, totalActivities: 4, completedActivityIds: ["activity-1", "activity-2"] },
    }),
    saveActivityAttempt: async () => { throw conflict; },
  });
  await player.init("assignment-1");

  await assert.rejects(
    player.saveActivityAttempt("activity-2", "AUDIO", { videoPosition: 0.4 }, false),
    (error) => error.status === 409 && error.code === "REVISION_CONFLICT",
  );

  const state = player.getState();
  assert.equal(calls.saves.length, 1);
  assert.equal(calls.loadCourse, 2);
  assert.equal(state.course.progress.percent, 50);
  assert.equal(state.course.units[0].lessons[0].activities[1].isCompleted, true);
});

test("speech completion is confirmed by a fresh course read when the write response omits its progress row", async () => {
  const { player, calls } = loadPlayer({
    search: "?id=assignment-1&activityId=activity-3",
    loadCourse: (loadNo) => {
      if (loadNo === 1) return courseFixture();
      const refreshed = courseFixture({
        progress: { percent: 50, completedActivities: 2, totalActivities: 4, completedActivityIds: ["activity-1", "activity-3"] },
      });
      refreshed.units[0].lessons[0].activities[2].progress = { revision: 1, completed: true, position: 1 };
      return refreshed;
    },
  });
  await player.init("assignment-1");

  await player.applyServerActivityResult("activity-3", {
    courseCompletion: { progressPercent: 50, completedRequiredCount: 2, requiredActivityCount: 4 },
  });

  const state = player.getState();
  assert.equal(calls.loadCourse, 2);
  assert.equal(state.activityProgressMap["activity-3"].revision, 1);
  assert.equal(state.currentActivity.isCompleted, true);
});

test("course submission waits for 100% server progress and sends only one request", async () => {
  let resolveSubmit;
  const pending = new Promise((resolve) => { resolveSubmit = resolve; });
  const { player, calls } = loadPlayer({
    loadCourse: () => courseFixture({
      progress: { percent: 100, completedActivities: 4, totalActivities: 4, completedActivityIds: ["activity-1", "activity-2", "activity-3"] },
    }),
    submitCourse: () => pending,
  });
  await player.init("assignment-1");

  const first = player.submitCourse();
  const duplicate = player.submitCourse();
  assert.equal(calls.submits, 1);
  resolveSubmit({ status: "SUBMITTED", revision: 1 });
  await Promise.all([first, duplicate]);
  await player.submitCourse();
  assert.equal(calls.submits, 1);
  assert.equal(player.getState().submissionStatus, "SUBMITTED");
});

test("a submit conflict refreshes status and does not write a second submission", async () => {
  const conflict = Object.assign(new Error("stale submission revision"), { status: 409, code: "CONFLICT" });
  const { player, calls } = loadPlayer({
    loadCourse: (loadNo) => courseFixture({
      progress: { percent: 100, completedActivities: 4, totalActivities: 4, completedActivityIds: ["activity-1", "activity-2", "activity-3"] },
      existingSubmission: loadNo > 1 ? { status: "SUBMITTED", revision: 1 } : { status: "IN_PROGRESS", revision: 0 },
    }),
    submitCourse: async () => { throw conflict; },
  });
  await player.init("assignment-1");

  const result = await player.submitCourse();
  assert.equal(result.alreadySubmitted, true);
  assert.equal(calls.submits, 1);
  assert.equal(calls.loadCourse, 2);
  assert.equal(player.getState().submissionStatus, "SUBMITTED");
});
