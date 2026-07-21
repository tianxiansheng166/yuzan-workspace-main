/**
 * AI Provider Stub — Deterministic local testing for the AI lesson planning pipeline.
 *
 * Replaces the real AI provider (via Flowise) with a configurable stub that
 * returns predefined responses. Used for:
 *   - Local development without real API keys
 *   - Integration testing of the Worker + API pipeline
 *   - Testing error handling (invalid JSON, schema violations, timeouts, auth errors)
 *
 * Usage:
 *   AI_PROVIDER_STUB=true pnpm --filter @yuzan/worker dev
 *
 * Supported stub scenarios (set via AI_STUB_SCENARIO env var):
 *   valid-output     — Returns a valid lesson plan (default)
 *   invalid-json     — Returns malformed JSON
 *   schema-invalid   — Returns valid JSON that fails schema validation
 *   timeout          — Delays response beyond AI_TIMEOUT_MS
 *   401              — Returns HTTP 401 Unauthorized
 *   500              — Returns HTTP 500 Internal Server Error
 *
 * This stub is ONLY used when AI_PROVIDER_STUB=true is set.
 * It does NOT replace the Flowise runtime — it replaces the internal proxy
 * that Flowise calls for LLM inference.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

// Valid lesson plan output matching lesson-plan-output.schema.json
const VALID_LESSON_PLAN = {
  schemaVersion: "lesson-plan.v0",
  title: "G3-4 语文《观潮》教案",
  summary: "面向三年级学生的国家通用语言文字教学教案，通过《观潮》一课培养学生的阅读理解与口头表达能力。",
  context: {
    gradeBand: "G3-4",
    durationMinutes: 40,
    courseTitle: "语文三年级上册",
    lessonTitle: "观潮",
  },
  objectives: [
    {
      id: "obj-1",
      description: "能正确朗读课文，理解钱塘江大潮的壮观景象",
      domain: "reading",
      bloomLevel: "understand",
    },
    {
      id: "obj-2",
      description: "能用通顺的语言描述潮来时的情景",
      domain: "speaking",
      bloomLevel: "apply",
    },
  ],
  keyPoints: [
    { id: "kp-1", description: "理解"天下奇观"的含义" },
    { id: "kp-2", description: "把握潮来前、潮来时、潮去后的顺序" },
  ],
  difficulties: [
    {
      id: "diff-1",
      description: "理解比喻句在描写潮水中的作用",
      strategy: "通过图片对比和朗读体会比喻的生动",
    },
  ],
  prerequisites: [
    { description: "能流利朗读二年级课文" },
  ],
  lessonFlow: [
    {
      phase: "导入",
      minutes: 5,
      teacherActions: ["出示钱塘江图片，引发兴趣", "提问：你见过大潮吗？"],
      studentActions: ["观察图片", "分享见闻"],
    },
    {
      phase: "新授",
      minutes: 20,
      teacherActions: ["范读课文", "讲解重点词语", "引导分析描写顺序"],
      studentActions: ["跟读课文", "标注关键词语", "小组讨论描写顺序"],
    },
    {
      phase: "练习",
      minutes: 10,
      teacherActions: ["组织朗读比赛", "指导口头描述"],
      studentActions: ["分角色朗读", "尝试描述潮水景象"],
    },
    {
      phase: "总结",
      minutes: 5,
      teacherActions: ["总结课文写作方法", "布置课后任务"],
      studentActions: ["回顾学习要点", "记录课后任务"],
    },
  ],
  teacherReviewChecklist: [
    "教学目标是否可观察、可评估？",
    "课堂流程时间分配是否合理？",
    "师生活动是否与目标一一对应？",
    "是否包含听、说、读、写适当组合？",
  ],
};

const SCHEMA_INVALID_OUTPUT = {
  schemaVersion: "lesson-plan.v0",
  // Missing required fields: title, summary, context, objectives, keyPoints, difficulties, lessonFlow, teacherReviewChecklist
  partialData: "This is intentionally incomplete",
};

const INVALID_JSON_STRING = `{ "schemaVersion": "lesson-plan.v0", "title": "Broken JSON`, 

type StubScenario = "valid-output" | "invalid-json" | "schema-invalid" | "timeout" | "401" | "500";

function getScenario(): StubScenario {
  const env = process.env.AI_STUB_SCENARIO ?? "valid-output";
  const valid: StubScenario[] = ["valid-output", "invalid-json", "schema-invalid", "timeout", "401", "500"];
  return valid.includes(env as StubScenario) ? (env as StubScenario) : "valid-output";
}

/**
 * Handle a stub request, simulating the OpenAI-compatible chat completions API.
 */
export function handleStubRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const scenario = getScenario();

  switch (scenario) {
    case "401":
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Invalid API key", type: "invalid_request_error" } }));
      return true;

    case "500":
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Internal server error", type: "server_error" } }));
      return true;

    case "timeout":
      // Never respond — caller will hit AI_TIMEOUT_MS
      return true;

    case "invalid-json":
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "stub-response",
        choices: [{
          message: { content: INVALID_JSON_STRING },
          finish_reason: "stop",
        }],
      }));
      return true;

    case "schema-invalid":
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "stub-response",
        choices: [{
          message: { content: JSON.stringify(SCHEMA_INVALID_OUTPUT) },
          finish_reason: "stop",
        }],
      }));
      return true;

    case "valid-output":
    default:
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "stub-response",
        choices: [{
          message: { content: JSON.stringify(VALID_LESSON_PLAN) },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 500, completion_tokens: 2000, total_tokens: 2500 },
      }));
      return true;
  }
}

/**
 * Check if the stub is enabled via environment variable.
 */
export function isStubEnabled(): boolean {
  return process.env.AI_PROVIDER_STUB === "true";
}
