import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const evidenceDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(evidenceDir, "../..");
const frontendRoot = resolve(repoRoot, "frontend");
const practiceDefinitionId = "definition-t076-fixture";
const attemptId = "attempt-t076-fixture";
const practice = {
  id: practiceDefinitionId,
  title: "TEST_FIXTURE_ONLY · 阅读练习",
  summary: "隔离视觉夹具，不是正式课堂内容。",
  gradeBand: "四年级",
  difficulty: "基础",
  estimatedMinutes: 10,
  abilityCategories: ["阅读理解"],
  cultureTags: [],
  catalogType: "SPECIALIZED",
  mode: "SELF_PRACTICE",
  itemTypes: ["SHORT_ANSWER"],
  studentState: { completionStatus: "IN_PROGRESS", favorite: false },
  recommendationReason: "TEST_FIXTURE_ONLY · 仅供页面布局核对",
  sections: [{ title: "阅读理解", description: "TEST_FIXTURE_ONLY", estimatedMinutes: 10, itemCount: 1 }],
  oralItemCount: 0,
  writtenItemCount: 1,
  requiresRecording: false,
  scoringDisclosure: "此视觉夹具不生成成绩。",
};
const item = {
  id: "item-t076-fixture",
  itemType: "SHORT_ANSWER",
  sectionTitle: "阅读理解",
  prompt: {
    stimulus: { type: "TEXT", promptText: "TEST_FIXTURE_ONLY：一段用于页面核对的短文。" },
    response: { type: "TEXT", placeholder: "仅为视觉核对，不会保存到服务器。" },
  },
  studentAnswer: { content: { responseType: "TEXT", value: "TEST_FIXTURE_ONLY answer" } },
};

const apiStub = `window.YuzanApi = {
  getToken: () => "TEST_FIXTURE_ONLY",
  requireAuth: () => true,
  getCoursePracticeContext: () => null,
  listPractices: async () => ({ items: [${JSON.stringify(practice)}], facets: {}, total: 1, nextCursor: null }),
  listAssignedRemediations: async () => ({ items: [] }),
  listAssessmentSessions: async () => ({ items: [{ id: "${attemptId}", status: "IN_PROGRESS", updatedAt: "2026-10-20T00:00:00.000Z" }] }),
  getPracticeAttempt: async (id) => ({ id, enrollmentId: "fixture-enrollment", practiceDefinitionId: "${practiceDefinitionId}", status: "IN_PROGRESS" }),
  getPracticeAttemptItems: async () => [${JSON.stringify(item)}],
  getPractice: async () => (${JSON.stringify(practice)}),
};`;
const banner = `<style>.t076-fixture-banner{padding:7px 16px;background:#fff0b8;color:#594300;border-bottom:1px solid #d8b95d;font:600 12px/1.4 system-ui,sans-serif;position:relative;z-index:100}</style><div class="t076-fixture-banner">TEST_FIXTURE_ONLY · isolated visual fixture · no NestAPI/PG and no official content</div>`;

async function htmlFor(filename, replacements = []) {
  let html = await readFile(resolve(frontendRoot, filename), "utf8");
  for (const [from, to] of replacements) html = html.replace(from, to);
  return html;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (pathname === "/student/practices/" || pathname === "/student/practices") {
      const html = await htmlFor("assessment/practice-shell.html", [
        ["__ASSESSMENT_PAGE__", "catalog"],
        ['<body data-practice-page="catalog">', `<body data-practice-page="catalog">${banner}`],
        ['<script src="/assets/api-client.js?v=202607212330"></script>', `<script src="/assets/api-client.js?v=202607212330"></script><script>${apiStub}</script>`],
      ]);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (pathname === `/student/practices/attempts/${attemptId}/runner/`) {
      const html = await htmlFor("assessment/runner.html", [
        ['<body data-runner-page="runner">', `<body data-runner-page="runner">${banner}`],
        ['<script src="/assets/api-client.js"></script>', `<script src="/assets/api-client.js"></script><script>${apiStub}</script>`],
      ]);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const assetPath = resolve(frontendRoot, pathname.slice(1));
    if (!assetPath.startsWith(`${frontendRoot}${sep}`)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    const body = await readFile(assetPath);
    const contentType = ({ ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg" })[extname(assetPath)] || "application/octet-stream";
    response.writeHead(200, { "content-type": `${contentType}; charset=utf-8` });
    response.end(body);
  } catch (error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end(error.message || "not found");
  }
});

server.listen(4176, "127.0.0.1", () => process.stdout.write("T076 visual fixture server: http://127.0.0.1:4176\n"));
