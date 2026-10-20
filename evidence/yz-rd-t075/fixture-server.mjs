import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const frontendRoot = path.join(repoRoot, "frontend");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const mockApi = `(() => {
  window.__t075FixtureWrites = { progress: 0, submit: 0 };
  const completeMode = new URLSearchParams(location.search).get("fixtureMode") === "complete";
  const activityIds = ["fixture-text", "fixture-audio", "fixture-speech", "fixture-video"];
  const course = (assignmentId) => ({
    assignment: { id: assignmentId, title: "TEST_FIXTURE_ONLY Course Continuity" },
    course: { id: "fixture-course", title: "TEST_FIXTURE_ONLY Course Continuity" },
    courseVersion: {
      id: "fixture-version",
      title: "TEST_FIXTURE_ONLY Course Continuity",
      description: "Synthetic isolated browser data for UI evidence only.",
      gradeBand: "五年级",
      capabilityTheme: "课程连续学习",
      estimatedMinutes: 20,
      objectives: [{ originalText: "按章节继续学习并查看服务器确认的进度" }],
    },
    units: [{
      id: "fixture-unit",
      title: "TEST_FIXTURE_ONLY Unit 1",
      sortOrder: 1,
      lessons: [{
        id: "fixture-lesson",
        title: "TEST_FIXTURE_ONLY Lesson 1",
        sortOrder: 1,
        activities: [
          { id: activityIds[0], type: "TEXT", title: "阅读并确认", instruction: "阅读本节内容后确认", content: { text: "这是隔离的合成页面内容，不代表正式课程。" }, required: true, progress: { revision: 0, completed: completeMode, position: completeMode ? 1 : 0 } },
          { id: activityIds[1], type: "AUDIO", title: "收听课程音频", instruction: "完整播放后保存学习进度", resources: [{ purpose: "AUDIO", resource: { id: "fixture-audio-resource", kind: "AUDIO", mediaType: "audio/wav" } }], required: true, progress: { revision: 0, completed: completeMode, position: completeMode ? 1 : 0 } },
          { id: activityIds[2], type: "SPEECH", title: "口语跟读", instruction: "请朗读示范文本", content: { demoText: "TEST_FIXTURE_ONLY synthetic speech prompt" }, required: true, progress: { revision: 0, completed: completeMode, position: completeMode ? 1 : 0 } },
          { id: activityIds[3], type: "VIDEO", title: "视频学习", instruction: "本视觉夹具不提供媒体文件", required: true, progress: { revision: 0, completed: completeMode, position: completeMode ? 1 : 0 } },
        ],
      }],
    }],
    studentProgress: {
      progressPercent: completeMode ? 100 : 0,
      completedRequiredCount: completeMode ? 4 : 0,
      requiredActivityCount: 4,
      requiredPracticeCount: 0,
      completedPracticeCount: 0,
      attainmentStatus: completeMode ? "PASSED" : "PENDING",
      completedActivityIds: completeMode ? activityIds : [],
    },
    existingSubmission: { id: "fixture-submission", status: "IN_PROGRESS", revision: 4 },
    practiceReferences: [],
  });

  window.YuzanApi = {
    getStudentCourse: async (assignmentId) => course(assignmentId),
    createOrResumeCourseSubmission: async () => ({ submission: { id: "fixture-submission", enrollmentId: "fixture-enrollment", status: "IN_PROGRESS", revision: 4 }, resumed: true }),
    listStudentActivityNotes: async () => ({ items: [] }),
    getStudentRecommendationsForCourse: async () => ({ items: [] }),
    getStudentCoursesDashboard: async () => ({ weeklyMinutes: 0, consecutiveDays: 0, coursesLearned: 0, badgesEarned: 0, totalMinutes: 0, recentDays: [] }),
    getResourcePlaybackUrl: async () => ({ url: "data:audio/wav;base64,UklGRg==", mediaType: "audio/wav" }),
    saveCourseActivityAttempt: async (_assignmentId, _submissionId, activityId, payload) => {
      window.__t075FixtureWrites.progress++;
      return {
        attempt: { id: "fixture-attempt", kind: payload.kind, value: payload.value },
        progress: { revision: 1, completed: true, position: 1 },
        courseCompletion: { progressPercent: 25, completedRequiredCount: 1, requiredActivityCount: 4, requiredPracticeCount: 0, completedPracticeCount: 0, attainmentStatus: "PENDING", completedActivityIds: [activityId] },
      };
    },
    submitStudentCourse: async (_assignmentId, submissionId, revision) => {
      window.__t075FixtureWrites.submit++;
      return { submission: { id: submissionId, status: "SUBMITTED", revision: revision + 1, submittedAt: "2026-10-20T00:00:00.000Z" }, courseCompletion: { progressPercent: 100, completedRequiredCount: 4, requiredActivityCount: 4, completedActivityIds: activityIds } };
    },
    addCourseFavorite: async () => ({ favorited: true }),
    removeCourseFavorite: async () => ({ favorited: false }),
  };
})();`;

const browserEvidence = `<script>
window.addEventListener("load", () => setTimeout(async () => {
  const params = new URLSearchParams(location.search);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    let state = window.CoursePlayerState.getState();
    document.body.dataset.t075InitialActivity = state.currentActivityId || "";
    document.body.dataset.t075InitialProgress = String(state.course && state.course.progress.percent);
    if (params.get("fixtureCheck") === "continuity") {
      const confirm = document.querySelector("#cpExercisesList .cp-exercise-submit");
      if (!confirm) throw new Error("server-confirmation control missing");
      confirm.click();
      await pause(20);
      state = window.CoursePlayerState.getState();
      document.body.dataset.t075SavedCount = String(window.__t075FixtureWrites.progress);
      document.body.dataset.t075SavedProgress = String(state.course.progress.percent);
      document.body.dataset.t075SavedCompleted = String(state.currentActivity.isCompleted);
      const next = document.querySelector('[data-activity-id="fixture-speech"]');
      if (!next) throw new Error("chapter activity link missing");
      next.click();
      await pause(20);
      state = window.CoursePlayerState.getState();
      document.body.dataset.t075ResumedActivity = state.currentActivityId;
      document.body.dataset.t075ResumedChapter = document.getElementById("cpBreadcrumbChapter").textContent;
      document.body.dataset.t075ResumedUrlActivity = new URL(location.href).searchParams.get("activityId") || "";
    }
    if (params.get("fixtureCheck") === "submit") {
      const submit = document.getElementById("cpCourseSubmitBtn");
      if (!submit || submit.disabled) throw new Error("completed course submit control unavailable");
      submit.click();
      await pause(30);
      document.body.dataset.t075SubmitCount = String(window.__t075FixtureWrites.submit);
      document.body.dataset.t075SubmitStatus = window.CoursePlayerState.getState().submissionStatus;
    }
    document.body.dataset.t075FixtureCheck = "PASS";
  } catch (error) {
    document.body.dataset.t075FixtureCheck = "FAIL";
    document.body.dataset.t075FixtureError = error && error.message ? error.message : String(error);
  }
}, 100));
</script>`;

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  if (pathname === "/assets/api-client.js") {
    response.writeHead(200, { "content-type": mimeTypes[".js"], "cache-control": "no-store" });
    response.end(mockApi);
    return;
  }

  const relativePath = pathname === "/student/courses/course-detail/"
    ? "student/courses/course-detail/index.html"
    : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(frontendRoot, relativePath);
  if (!filePath.startsWith(frontendRoot + path.sep)) {
    response.writeHead(403).end("forbidden");
    return;
  }

  try {
    const extension = path.extname(filePath);
    let body = await fs.readFile(filePath);
    if (filePath.endsWith("/student/courses/course-detail/index.html")) {
      body = Buffer.from(body.toString("utf8").replace("</body>", `${browserEvidence}</body>`));
    }
    response.writeHead(200, { "content-type": mimeTypes[extension] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write(`TEST_FIXTURE_ONLY server: http://127.0.0.1:${address.port}\n`);
});
