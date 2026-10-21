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
    ...overrides,
  };
  const window = { location: { search } };
  vm.runInNewContext(source, {
    window,
    CourseApiAdapter: adapter,
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
