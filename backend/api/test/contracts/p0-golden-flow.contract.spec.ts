/**
 * P0-CONTRACT-CONVERGENCE-001 黄金闭环契约测试
 *
 * 验证前后端契约收敛的关键不变量：
 * 1. ClassAssessmentDto 校验语义（enrollmentIds/questionIds 可省略、type 含 COMPREHENSIVE）
 * 2. 黄金闭环稳定错误码异常类的 HTTP 状态与 code 载荷
 * 3. OpenAPI 契约文件中黄金闭环端点与 schema 定义存在
 *
 * 该测试不依赖数据库，可在 Prisma client 未生成时独立运行。
 */
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ClassAssessmentDto } from "../../src/modules/classes/dto/class-assessment.dto.js";
import {
  AssessmentConflictException,
  AssessmentForbiddenException,
  AssessmentHasNoItemsException,
  AssessmentItemNotFoundException,
  AssessmentNotFoundException,
  AssessmentProcessingPendingException,
  AssessmentValidationFailedException,
  PracticeContentEmptyException,
} from "../../src/modules/assessment/domain/assessment.errors.js";
import {
  AudioQualityRejectedException,
  ProviderNotConfiguredException,
  RecordingForbiddenException,
  RecordingNotFoundException,
} from "../../src/modules/recordings/domain/recording.errors.js";
import {
  SpeechJobCallbackUnauthorizedException,
  SpeechJobForbiddenException,
  SpeechJobNotFoundException,
  SpeechProviderNotConfiguredException,
  SpeechProviderUnavailableException,
} from "../../src/modules/speech-job/domain/speech-job.errors.js";

/** 读取 OpenAPI 契约文件（与 backend/api 同 monorepo 顶层的 packages/contracts）。 */
function readOpenApiYaml(): string {
  // 从 backend/api/test/contracts 向上回退到 monorepo root，再进入 packages/contracts。
  const candidates = [
    resolve(__dirname, "../../../../packages/contracts/openapi/openapi.yaml"),
    resolve(__dirname, "../../../../../packages/contracts/openapi/openapi.yaml"),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      // continue
    }
  }
  throw new Error("openapi.yaml not found from contract test");
}

async function validateDto(payload: Record<string, unknown>): Promise<string[]> {
  const instance = plainToInstance(ClassAssessmentDto, payload);
  const errors = await validate(instance, { skipMissingProperties: false });
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

function expectStableCode(error: { getStatus: () => number; getResponse: () => unknown }, status: number, code: string) {
  expect(error.getStatus()).toBe(status);
  const body = error.getResponse() as { code: string; message: string };
  expect(body.code).toBe(code);
  expect(body.message).toBeTruthy();
}

describe("P0 Golden Flow Contract", () => {
  // ─── 1. ClassAssessmentDto 校验语义 ───
  describe("ClassAssessmentDto", () => {
    it("accepts READING type with only title (enrollmentIds/questionIds both omitted)", async () => {
      const errs = await validateDto({ type: "READING", title: "朗读测评" });
      expect(errs).toEqual([]);
    });

    it("accepts COMPREHENSIVE type (backward-compatible alias for MIXED)", async () => {
      const errs = await validateDto({ type: "COMPREHENSIVE" });
      expect(errs).toEqual([]);
    });

    it("rejects unknown type values", async () => {
      const errs = await validateDto({ type: "SPEAKING" });
      expect(errs.length).toBeGreaterThan(0);
    });

    it("treats enrollmentIds as optional (省略合法)", async () => {
      const errs = await validateDto({ type: "WRITTEN" });
      expect(errs).not.toContain("enrollmentIds should not be empty");
      expect(errs).toEqual([]);
    });

    it("treats questionIds as optional (省略合法,由 service 层强制非空)", async () => {
      const errs = await validateDto({ type: "READING" });
      expect(errs).toEqual([]);
    });

    it("rejects non-UUID enrollmentIds entries", async () => {
      const errs = await validateDto({ type: "READING", enrollmentIds: ["not-a-uuid"] });
      expect(errs.length).toBeGreaterThan(0);
    });

    it("rejects non-UUID questionIds entries", async () => {
      const errs = await validateDto({ type: "READING", questionIds: ["bad"] });
      expect(errs.length).toBeGreaterThan(0);
    });
  });

  // ─── 2. 稳定错误码异常类 ───
  describe("Assessment stable error codes", () => {
    it("AssessmentNotFoundException → 404 ASSESSMENT_NOT_FOUND", () => {
      expectStableCode(new AssessmentNotFoundException(), 404, "ASSESSMENT_NOT_FOUND");
    });
    it("AssessmentForbiddenException → 403 FORBIDDEN_RESOURCE", () => {
      expectStableCode(new AssessmentForbiddenException(), 403, "FORBIDDEN_RESOURCE");
    });
    it("AssessmentConflictException → 409 CONFLICT", () => {
      expectStableCode(new AssessmentConflictException(), 409, "CONFLICT");
    });
    it("AssessmentItemNotFoundException → 404 ASSESSMENT_ITEM_NOT_FOUND", () => {
      expectStableCode(new AssessmentItemNotFoundException(), 404, "ASSESSMENT_ITEM_NOT_FOUND");
    });
    it("AssessmentHasNoItemsException → 422 ASSESSMENT_HAS_NO_ITEMS", () => {
      expectStableCode(new AssessmentHasNoItemsException(), 422, "ASSESSMENT_HAS_NO_ITEMS");
    });
    it("PracticeContentEmptyException → 422 PRACTICE_CONTENT_EMPTY", () => {
      expectStableCode(new PracticeContentEmptyException(), 422, "PRACTICE_CONTENT_EMPTY");
    });
    it("AssessmentValidationFailedException → 400 VALIDATION_FAILED", () => {
      expectStableCode(new AssessmentValidationFailedException("bad input"), 400, "VALIDATION_FAILED");
    });
    it("AssessmentProcessingPendingException → 202 PROCESSING_PENDING", () => {
      expectStableCode(new AssessmentProcessingPendingException(), 202, "PROCESSING_PENDING");
    });
  });

  describe("Recording stable error codes", () => {
    it("RecordingNotFoundException → 404 RECORDING_NOT_FOUND", () => {
      expectStableCode(new RecordingNotFoundException(), 404, "RECORDING_NOT_FOUND");
    });
    it("RecordingForbiddenException → 403 FORBIDDEN_RESOURCE", () => {
      expectStableCode(new RecordingForbiddenException(), 403, "FORBIDDEN_RESOURCE");
    });
    it("AudioQualityRejectedException → 422 AUDIO_QUALITY_REJECTED", () => {
      expectStableCode(new AudioQualityRejectedException(), 422, "AUDIO_QUALITY_REJECTED");
    });
    it("ProviderNotConfiguredException → 503 PROVIDER_NOT_CONFIGURED", () => {
      expectStableCode(new ProviderNotConfiguredException(), 503, "PROVIDER_NOT_CONFIGURED");
    });
  });

  describe("SpeechJob stable error codes", () => {
    it("SpeechJobNotFoundException → 404 SPEECH_JOB_NOT_FOUND", () => {
      expectStableCode(new SpeechJobNotFoundException(), 404, "SPEECH_JOB_NOT_FOUND");
    });
    it("SpeechJobForbiddenException → 403 FORBIDDEN_RESOURCE", () => {
      expectStableCode(new SpeechJobForbiddenException(), 403, "FORBIDDEN_RESOURCE");
    });
    it("SpeechJobCallbackUnauthorizedException → 401 UNAUTHENTICATED", () => {
      expectStableCode(new SpeechJobCallbackUnauthorizedException(), 401, "UNAUTHENTICATED");
    });
    it("SpeechProviderNotConfiguredException → 503 PROVIDER_NOT_CONFIGURED", () => {
      expectStableCode(new SpeechProviderNotConfiguredException(), 503, "PROVIDER_NOT_CONFIGURED");
    });
    it("SpeechProviderUnavailableException → 503 PROVIDER_UNAVAILABLE", () => {
      expectStableCode(new SpeechProviderUnavailableException(), 503, "PROVIDER_UNAVAILABLE");
    });
  });

  // ─── 3. OpenAPI 契约文件结构 ───
  describe("OpenAPI golden flow endpoints", () => {
    const yaml = readOpenApiYaml();

    it("declares createClassAssessment endpoint", () => {
      expect(yaml).toContain("/schools/{schoolId}/classes/{classId}/assessments:");
      expect(yaml).toContain("operationId: createClassAssessment");
    });

    it("declares recording lifecycle endpoints", () => {
      expect(yaml).toContain("operationId: initRecording");
      expect(yaml).toContain("operationId: completeRecording");
      expect(yaml).toContain("operationId: getRecordingEvidence");
    });

    it("declares speech-job endpoints", () => {
      expect(yaml).toContain("operationId: createSpeechJob");
      expect(yaml).toContain("operationId: getSpeechJob");
      expect(yaml).toContain("operationId: updateSpeechJobResult");
    });

    it("declares assessment session endpoints", () => {
      expect(yaml).toContain("operationId: createAssessmentSession");
      expect(yaml).toContain("operationId: startAssessmentSession");
      expect(yaml).toContain("operationId: submitAssessmentSession");
      expect(yaml).toContain("operationId: getAssessmentReport");
      expect(yaml).toContain("operationId: exportAssessmentReport");
    });

    it("declares ClassAssessmentRequest schema", () => {
      expect(yaml).toContain("ClassAssessmentRequest:");
    });

    it("declares stable error code responses", () => {
      expect(yaml).toContain("AssessmentContentEmpty:");
      expect(yaml).toContain("AudioQualityRejected:");
      expect(yaml).toContain("ProviderNotConfigured:");
      expect(yaml).toContain("ProviderUnavailable:");
      expect(yaml).toContain("ProcessingPending:");
    });

    it("does not use OpenAPI 3.0 nullable: true (must use type: [xxx, null])", () => {
      expect(yaml).not.toMatch(/nullable:\s*true/);
    });
  });

  // ─── 4. no-ambiguous-paths 误报证明 ───
  // redocly 的 no-ambiguous-paths 规则标记以下两条路径为"歧义"：
  //   GET  /schools/{schoolId}/speech-jobs/by-item/{assessmentItemId}
  //   PUT  /schools/{schoolId}/speech-jobs/{jobId}/result
  // 以下测试证明这是工具误报，运行时不存在路由歧义。
  describe("no-ambiguous-paths: speech-jobs route disambiguation", () => {
    const yaml = readOpenApiYaml();
    const controllerSrc = readFileSync(
      resolve(__dirname, "../../src/modules/speech-job/speech-job.controller.ts"),
      "utf8",
    );

    it("declares both flagged paths in OpenAPI", () => {
      expect(yaml).toContain("/schools/{schoolId}/speech-jobs/by-item/{assessmentItemId}:");
      expect(yaml).toContain("/schools/{schoolId}/speech-jobs/{jobId}/result:");
    });

    it("by-item path uses GET, result path uses PUT — different HTTP methods never conflict", () => {
      // Extract the by-item path block and verify it has GET (not PUT)
      const byItemBlock = yaml.match(
        /\/schools\/\{schoolId\}\/speech-jobs\/by-item\/\{assessmentItemId\}:\n([\s\S]*?)(?=\n\/|\ncomponents:|$)/,
      );
      expect(byItemBlock).toBeTruthy();
      expect(byItemBlock![1]).toMatch(/^\s+get:/);
      expect(byItemBlock![1]).not.toMatch(/^\s+put:/);

      // Extract the {jobId}/result path block and verify it has PUT (not GET)
      const resultBlock = yaml.match(
        /\/schools\/\{schoolId\}\/speech-jobs\/\{jobId\}\/result:\n([\s\S]*?)(?=\n\/|\ncomponents:|$)/,
      );
      expect(resultBlock).toBeTruthy();
      expect(resultBlock![1]).toMatch(/^\s+put:/);
      expect(resultBlock![1]).not.toMatch(/^\s+get:/);
    });

    it("by-item is a fixed path segment, not a path parameter", () => {
      // The literal string "by-item" appears as a fixed segment in the path.
      // It must NOT appear as a path parameter like {by-item}.
      expect(yaml).toContain("/speech-jobs/by-item/{assessmentItemId}");
      expect(yaml).not.toMatch(/\{by-item\}/);
    });

    it("{jobId} parameter declares UUID format in OpenAPI", () => {
      // Find the jobId parameter definition within speech-jobs paths
      const jobIdParam = yaml.match(
        /name:\s*jobId[\s\S]*?schema:[\s\S]*?format:\s*uuid/,
      );
      expect(jobIdParam).toBeTruthy();
    });

    it("Controller uses ParseUUIDPipe on jobId — non-UUID 'by-item' would be rejected with 400", () => {
      // The controller source must use ParseUUIDPipe for the jobId parameter
      // in both getSpeechJob and updateSpeechJobResult handlers.
      const getJobIdPipe = controllerSrc.match(
        /getSpeechJob\([\s\S]*?@Param\("jobId",\s*ParseUUIDPipe\)/,
      );
      expect(getJobIdPipe).toBeTruthy();

      const putJobIdPipe = controllerSrc.match(
        /updateSpeechJobResult\([\s\S]*?@Param\("jobId",\s*ParseUUIDPipe\)/,
      );
      expect(putJobIdPipe).toBeTruthy();
    });

    it("GET /speech-jobs/:jobId matches 1 segment; GET /speech-jobs/by-item/:x matches 2 segments — no overlap", () => {
      // @Get(":jobId") matches /speech-jobs/{one-segment} (e.g. /speech-jobs/abc-123)
      // @Get("by-item/:assessmentItemId") matches /speech-jobs/by-item/{one-segment}
      // These have different segment counts and cannot conflict.
      expect(controllerSrc).toContain('@Get(":jobId")');
      expect(controllerSrc).toContain('@Get("by-item/:assessmentItemId")');
    });

    it("PUT /speech-jobs/by-item/result would fail UUID validation (by-item is not a UUID)", () => {
      // The only theoretical conflict: PUT /speech-jobs/by-item/result matches
      // the pattern PUT /speech-jobs/{jobId}/result with jobId="by-item".
      // But ParseUUIDPipe rejects "by-item" → 400 Bad Request.
      // The request NEVER reaches the handler, so no wrong-controller routing.
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test("by-item")).toBe(false);
      expect(uuidRegex.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });
  });
});
