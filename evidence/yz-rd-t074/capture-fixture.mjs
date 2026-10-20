import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const evidenceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(evidenceDir, "../..");
const frontendRoot = join(repoRoot, "frontend");
const apiFixture = `
(() => {
  const state = new URLSearchParams(location.search).get("fixtureState") || "teacher";
  const pending = state === "processing";
  const attemptId = "fixture-attempt-074";
  const today = {
    version: "student-today-v1",
    primaryAction: state === "teacher" ? {
      kind: "TEACHER_REMEDIATION",
      title: "TEST_FIXTURE_ONLY 老师布置的专项练习",
      reason: "老师为当前学籍开放了一项可继续的练习。",
      cta: "继续练习",
      target: { href: "/student/practices/attempts/" + attemptId + "/runner/" }
    } : null,
    waiting: pending ? [{ kind: "TEACHER_REVIEW", title: "专项巩固", reason: "这项练习正在等待老师复核。" }] : [],
    legacyTasks: [],
    summary: { latestFormalAssessment: null }
  };
  window.YuzanApi = {
    getToken: () => "TEST_FIXTURE_ONLY",
    getActiveSchoolId: () => "fixture-school-074",
    getStoredUser: () => ({ id: "fixture-student-074" }),
    getStudentProfile: async () => ({ profile: {
      userId: "fixture-student-074",
      displayName: "TEST_FIXTURE_ONLY 学生",
      schoolName: "隔离演示学校",
      gradeBand: "测试年级",
      className: "测试班"
    } }),
    getStudentToday: async () => {
      if (state === "error") throw Object.assign(new Error("测试权限拒绝"), { status: 403 });
      return today;
    },
    listStudentCourses: async () => ({ courses: state === "teacher" ? [{
      assignmentId: "fixture-assignment-074",
      title: "TEST_FIXTURE_ONLY 课程连续学习",
      progressPercent: 25,
      nextActivity: { title: "下一课：练习与反馈" }
    }] : [] }),
    listPractices: async () => ({ items: state === "teacher" ? [{
      id: "fixture-practice-074",
      title: "TEST_FIXTURE_ONLY 老师开放的练习",
      mode: "ASSIGNMENT",
      catalogType: "STANDARD",
      studentState: { completionStatus: "IN_PROGRESS" }
    }] : [] }),
    listAssessmentSessions: async () => ({
      items: pending ? [{ id: attemptId, status: "PROCESSING", purpose: "REMEDIATION", practiceTitle: "TEST_FIXTURE_ONLY 待复核练习" }] : [],
      nextCursor: null,
      hasMore: false
    }),
    getPracticeAttempt: async (id) => ({ id, purpose: "REMEDIATION", practiceDefinitionId: "fixture-practice-074" }),
    getPracticeAttemptItems: async () => ({ items: [] })
  };
})();
`;

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  if (pathname === "/__fixture/api-client.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    response.end(apiFixture);
    return;
  }

  const relative = pathname === "/student/today/"
    ? "student/today/index.html"
    : pathname.replace(/^\/+/, "");
  const file = resolve(frontendRoot, relative);
  if (file !== frontendRoot && !file.startsWith(frontendRoot + sep)) {
    response.writeHead(403);
    response.end("forbidden");
    return;
  }

  try {
    let body = readFileSync(file);
    if (file.endsWith("/student/today/index.html")) {
      body = Buffer.from(body.toString("utf8").replace(
        '<script src="/assets/api-client.js"></script>',
        '<script src="/__fixture/api-client.js"></script>',
      ));
    }
    response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

function runChrome(args) {
  return new Promise((resolveRun) => {
    const child = spawn(process.env.CHROME_BIN || "google-chrome", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 30000);
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolveRun({ status: null, error, stdout, stderr });
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({ status, signal, stdout, stderr });
    });
  });
}

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});

try {
  const port = server.address().port;
  for (const state of ["teacher", "processing", "empty", "error"]) {
    for (const width of [1280, 1440]) {
      const height = width === 1280 ? 900 : 1000;
      const output = join(evidenceDir, `${state}-${width}.png`);
      const profile = mkdtempSync(join(tmpdir(), "yz-rd-t074-chrome-"));
      const result = await runChrome([
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--window-size=${width},${height}`,
        "--virtual-time-budget=2500",
        `--user-data-dir=${profile}`,
        `--screenshot=${output}`,
        `http://127.0.0.1:${port}/student/today/?fixtureState=${state}`,
      ]);
      rmSync(profile, { recursive: true, force: true });
      if (result.status !== 0 || result.error || !existsSync(output) || !statSync(output).size) {
        throw new Error(`Chrome capture failed for ${state}-${width}: status=${result.status}; ${result.stderr || result.stdout || result.error || result.signal || "no screenshot"}`);
      }
      process.stdout.write(`${state}-${width}.png ${statSync(output).size} bytes\n`);
    }
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
