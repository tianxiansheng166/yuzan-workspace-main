import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("./course-player-state.js", import.meta.url),
  "utf8",
);

function mount(search, overrides = {}) {
  const calls = [];
  const adapter = {
    loadCourse: async (assignmentId) => {
      calls.push(["course", assignmentId]);
      return {
        assignmentId,
        units: [
          {
            title: "Unit",
            lessons: [
              {
                title: "Lesson",
                activities: [
                  {
                    activityId: "activity-first",
                    title: "First",
                    isCompleted: true,
                  },
                  {
                    activityId: "activity-requested",
                    title: "Requested",
                    isCompleted: false,
                  },
                ],
              },
            ],
          },
        ],
      };
    },
    createSubmission: async (assignmentId) => {
      calls.push(["submission", assignmentId]);
      return {
        id: "submission-live",
        enrollmentId: "enrollment-live",
        status: "IN_PROGRESS",
      };
    },
    loadNotes: async (assignmentId, activityId) => {
      calls.push(["notes", assignmentId, activityId]);
      return [];
    },
    loadRecommendations: async (assignmentId) => {
      calls.push(["recommendations", assignmentId]);
      return [];
    },
    loadDashboard: async () => {
      calls.push(["dashboard"]);
      return {};
    },
    saveActivityAttempt: async (...args) => {
      calls.push(["activity-attempt", ...args]);
      return {
        attempt: { id: "attempt-live" },
        progress: { revision: 1, completed: false, position: 0.6 },
        courseCompletion: {
          progressPercent: 40,
          completedRequiredCount: 1,
          requiredActivityCount: 2,
          completedActivityIds: [],
        },
      };
    },
    ...overrides,
  };
  const window = {
    location: {
      search,
      href: "http://localhost/student/courses/course-detail/" + search,
    },
    history: { replaceState() {} },
  };
  vm.runInNewContext(source, {
    window,
    CourseApiAdapter: adapter,
    URL,
    URLSearchParams,
    Promise,
    Error,
    Date,
    Math,
    Array,
  });
  return { state: window.CoursePlayerState, calls };
}

test("course detail preserves the requested dynamic activity and survives optional API failures", async () => {
  const f = mount("?id=assignment-dynamic&activityId=activity-requested", {
    loadRecommendations: async () => {
      throw new Error("recommendations unavailable");
    },
    loadDashboard: async () => {
      throw new Error("statistics unavailable");
    },
  });

  const state = await f.state.init("assignment-dynamic");

  assert.equal(state.assignmentId, "assignment-dynamic");
  assert.equal(state.course.assignmentId, "assignment-dynamic");
  assert.equal(state.submissionId, "submission-live");
  assert.equal(state.currentActivityId, "activity-requested");
  assert.equal(state.currentActivity.title, "Requested");
  assert.match(state.recommendationsError, /recommendations unavailable/);
  assert.match(state.dashboardError, /statistics unavailable/);
  assert.equal(state.loading, false);
  assert.equal(state.error, null);
  assert.ok(
    f.calls.some(
      (call) =>
        call[0] === "notes" &&
        call[1] === "assignment-dynamic" &&
        call[2] === "activity-requested",
    ),
  );
});

test("course detail chooses first incomplete activity when no valid activityId is requested", async () => {
  const f = mount("?id=assignment-dynamic&activityId=missing");

  const state = await f.state.init("assignment-dynamic");

  assert.equal(state.currentActivityId, "activity-requested");
  assert.equal(state.currentActivity.title, "Requested");
});

test("course video progress sends a fractional position with the dynamic course and activity IDs", async () => {
  const f = mount("?id=assignment-dynamic&activityId=activity-requested");
  await f.state.init("assignment-dynamic");
  f.state.updateVideoProgress(60, 30, 50);

  await f.state.saveActivityAttempt(
    "activity-requested",
    "VIDEO",
    { videoPosition: 0.6 },
    false,
  );

  const call = f.calls.find((entry) => entry[0] === "activity-attempt");
  assert.ok(call);
  assert.equal(call[1], "assignment-dynamic");
  assert.equal(call[2], "submission-live");
  assert.equal(call[3], "activity-requested");
  assert.equal(call[4].videoPosition, 0.6);
  assert.equal(call[4].expectedProgressRevision, 0);
  assert.equal(f.state.getState().course.progress.percent, 40);
  assert.equal(f.state.getState().activityProgressMap["activity-requested"].position, 0.6);
});

test("server incomplete progress stays incomplete after the client reports video ended", async () => {
  const f = mount("?id=assignment-dynamic&activityId=activity-requested", {
    saveActivityAttempt: async () => ({
      attempt: { id: "attempt-live" },
      progress: { revision: 1, completed: false, position: 1 },
      courseCompletion: {
        progressPercent: 0,
        completedRequiredCount: 0,
        requiredActivityCount: 2,
        completedActivityIds: [],
      },
    }),
  });
  await f.state.init("assignment-dynamic");

  await f.state.saveActivityAttempt(
    "activity-requested",
    "VIDEO",
    { videoPosition: 1 },
    true,
  );

  assert.equal(
    f.state.getState().activityProgressMap["activity-requested"].completed,
    false,
  );
  assert.equal(f.state.getState().currentActivity.isCompleted, false);
  assert.deepEqual(
    Array.from(f.state.getState().course.progress.completedActivityIds),
    [],
  );
});

test("server confirmed completion is reflected in course and activity state", async () => {
  const f = mount("?id=assignment-dynamic&activityId=activity-requested", {
    saveActivityAttempt: async () => ({
      attempt: { id: "attempt-live" },
      progress: { revision: 1, completed: true, position: 1 },
      courseCompletion: {
        progressPercent: 50,
        completedRequiredCount: 1,
        requiredActivityCount: 2,
        completedActivityIds: ["activity-requested"],
      },
    }),
  });
  await f.state.init("assignment-dynamic");

  await f.state.saveActivityAttempt(
    "activity-requested",
    "VIDEO",
    { videoPosition: 1 },
    true,
  );

  assert.equal(
    f.state.getState().activityProgressMap["activity-requested"].completed,
    true,
  );
  assert.equal(f.state.getState().currentActivity.isCompleted, true);
  assert.equal(f.state.getState().course.progress.percent, 50);
});

test("revision conflict refreshes server progress and keeps its incomplete state authoritative", async () => {
  let courseLoads = 0;
  const refreshedCourse = {
    assignmentId: "assignment-dynamic",
    progress: { percent: 0, completedActivityIds: [] },
    units: [
      {
        title: "Unit",
        lessons: [
          {
            title: "Lesson",
            activities: [
              {
                activityId: "activity-requested",
                title: "Requested",
                activityType: "VIDEO",
                isCompleted: false,
                progress: { revision: 4, position: 0.45, completed: false },
              },
            ],
          },
        ],
      },
    ],
  };
  const f = mount("?id=assignment-dynamic&activityId=activity-requested", {
    loadCourse: async () => {
      courseLoads += 1;
      if (courseLoads === 1) {
        return {
          ...refreshedCourse,
          units: [
            {
              title: "Unit",
              lessons: [
                {
                  title: "Lesson",
                  activities: [
                    {
                      activityId: "activity-requested",
                      title: "Requested",
                      activityType: "VIDEO",
                      isCompleted: false,
                    },
                  ],
                },
              ],
            },
          ],
        };
      }
      return refreshedCourse;
    },
    saveActivityAttempt: async () => {
      const error = new Error("revision conflict");
      error.status = 409;
      throw error;
    },
  });
  await f.state.init("assignment-dynamic");
  const refreshNotifications = [];
  f.state.subscribe((_state, keys) => refreshNotifications.push(keys));

  await assert.rejects(
    f.state.saveActivityAttempt(
      "activity-requested",
      "VIDEO",
      { videoPosition: 0.8 },
      true,
    ),
    (error) => error.status === 409,
  );

  assert.equal(courseLoads, 2);
  assert.equal(
    f.state.getState().activityProgressMap["activity-requested"].revision,
    4,
  );
  assert.equal(
    f.state.getState().activityProgressMap["activity-requested"].position,
    0.45,
  );
  assert.equal(
    f.state.getState().activityProgressMap["activity-requested"].completed,
    false,
  );
  assert.equal(f.state.getState().currentActivity.isCompleted, false);
  assert.ok(
    refreshNotifications.some((keys) =>
      keys.includes("course") && keys.includes("activityProgressMap"),
    ),
    "the page subscriber must receive the refreshed server-authoritative course state",
  );
});

test("late completion responses after an activity switch cannot replace newer server course status", async () => {
  const pending = new Map();
  const f = mount("?id=assignment-dynamic&activityId=activity-requested", {
    saveActivityAttempt: (...args) =>
      new Promise((resolve) => pending.set(args[2], resolve)),
  });
  await f.state.init("assignment-dynamic");

  f.state.setCurrentActivity("activity-first");
  const firstSave = f.state.saveActivityAttempt(
    "activity-first",
    "VIDEO",
    { videoPosition: 0.2 },
    false,
  );
  f.state.setCurrentActivity("activity-requested");
  const secondSave = f.state.saveActivityAttempt(
    "activity-requested",
    "VIDEO",
    { videoPosition: 1 },
    true,
  );

  pending.get("activity-requested")({
    attempt: { id: "attempt-requested" },
    progress: { revision: 1, completed: true, position: 1 },
    courseCompletion: {
      progressPercent: 50,
      completedRequiredCount: 1,
      requiredActivityCount: 2,
      completedActivityIds: ["activity-requested"],
    },
  });
  await secondSave;
  pending.get("activity-first")({
    attempt: { id: "attempt-first" },
    progress: { revision: 1, completed: false, position: 0.2 },
    courseCompletion: {
      progressPercent: 0,
      completedRequiredCount: 0,
      requiredActivityCount: 2,
      completedActivityIds: [],
    },
  });
  await firstSave;

  const state = f.state.getState();
  assert.equal(state.currentActivityId, "activity-requested");
  assert.equal(state.currentActivity.isCompleted, true);
  assert.equal(state.activityProgressMap["activity-first"].completed, false);
  assert.equal(state.activityProgressMap["activity-requested"].completed, true);
  assert.equal(state.course.progress.percent, 50);
  assert.deepEqual(
    Array.from(state.course.progress.completedActivityIds),
    ["activity-requested"],
  );
});

test("a late save cannot replace the latest server state refreshed after a 409", async () => {
  let courseLoads = 0;
  let resolveFirstSave;
  const refreshedCourse = {
    assignmentId: "assignment-dynamic",
    progress: { percent: 50, completedActivityIds: ["activity-requested"] },
    units: [
      {
        title: "Unit",
        lessons: [
          {
            title: "Lesson",
            activities: [
              {
                activityId: "activity-first",
                title: "First",
                activityType: "VIDEO",
                required: true,
                progress: { revision: 3, position: 0.4, completed: false },
              },
              {
                activityId: "activity-requested",
                title: "Requested",
                activityType: "VIDEO",
                required: true,
                progress: { revision: 2, position: 1, completed: true },
              },
            ],
          },
        ],
      },
    ],
  };
  const initialCourse = {
    ...refreshedCourse,
    progress: { percent: 0, completedActivityIds: [] },
    units: [
      {
        title: "Unit",
        lessons: [
          {
            title: "Lesson",
            activities: [
              { activityId: "activity-first", title: "First", activityType: "VIDEO", required: true },
              { activityId: "activity-requested", title: "Requested", activityType: "VIDEO", required: true },
            ],
          },
        ],
      },
    ],
  };
  const f = mount("?id=assignment-dynamic&activityId=activity-requested", {
    loadCourse: async () => {
      courseLoads += 1;
      return courseLoads === 1 ? initialCourse : refreshedCourse;
    },
    saveActivityAttempt: async (...args) => {
      if (args[2] === "activity-first") {
        return await new Promise((resolve) => {
          resolveFirstSave = resolve;
        });
      }
      const conflict = new Error("revision conflict");
      conflict.status = 409;
      throw conflict;
    },
  });
  await f.state.init("assignment-dynamic");

  f.state.setCurrentActivity("activity-first");
  const firstSave = f.state.saveActivityAttempt(
    "activity-first",
    "VIDEO",
    { videoPosition: 0.1 },
    false,
  );
  await assert.rejects(
    f.state.saveActivityAttempt(
      "activity-requested",
      "VIDEO",
      { videoPosition: 0.9 },
      true,
    ),
    (error) => error.status === 409,
  );

  resolveFirstSave({
    attempt: { id: "attempt-first" },
    progress: { revision: 1, position: 0.1, completed: false },
    courseCompletion: {
      progressPercent: 0,
      completedRequiredCount: 0,
      requiredActivityCount: 2,
      completedActivityIds: [],
    },
  });
  await firstSave;

  const state = f.state.getState();
  assert.equal(courseLoads, 2);
  assert.equal(state.activityProgressMap["activity-first"].revision, 3);
  assert.equal(state.activityProgressMap["activity-first"].position, 0.4);
  assert.equal(state.course.progress.percent, 50);
  assert.deepEqual(
    Array.from(state.course.progress.completedActivityIds),
    ["activity-requested"],
  );
});
