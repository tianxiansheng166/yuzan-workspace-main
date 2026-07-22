import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { Public } from "../../common/security/public.decorator.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { StoragePort } from "../../shared/storage/storage.port.js";
import { STORAGE_PORT } from "../../shared/storage/storage.port.js";
import { AssessmentService } from "../assessment/assessment.service.js";
import { AiLessonPlanningService } from "../ai-lesson-planning/ai-lesson-planning.service.js";

/**
 * Internal API controller for Worker callbacks.
 *
 * All endpoints require X-Internal-Key header matching API_INTERNAL_KEY env var.
 * These endpoints are NOT part of the public API and are used by the Worker
 * to update speech job results, assessment items, and recording status.
 *
 * Marked as @Public() because they use X-Internal-Key auth, not user sessions.
 */
@Public()
@Controller("internal")
export class InternalController {
  private readonly internalKey: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    private readonly assessmentService: AssessmentService,
    private readonly aiLessonPlanningService: AiLessonPlanningService,
    config: ConfigService,
  ) {
    this.internalKey = config.get<string>("API_INTERNAL_KEY") ?? "";
  }

  /**
   * Validate internal API key using constant-time comparison.
   * Accepts key from either X-Internal-Key header or Authorization: Bearer header.
   */
  private validateKey(
    xInternalKey: string | undefined,
    authorization: string | undefined,
  ): void {
    if (!this.internalKey) {
      throw Object.assign(
        new Error("Internal API key not configured"),
        { code: "PROVIDER_NOT_CONFIGURED" },
      );
    }

    // Extract key: prefer X-Internal-Key, fall back to Authorization: Bearer
    const key = xInternalKey ?? this.extractBearerToken(authorization);
    if (!key) {
      throw Object.assign(
        new Error("Missing internal API key"),
        { code: "FORBIDDEN" },
      );
    }

    // Constant-time comparison to prevent timing attacks
    const keyBuf = Buffer.from(key, "utf-8");
    const expectedBuf = Buffer.from(this.internalKey, "utf-8");
    if (keyBuf.length !== expectedBuf.length || !timingSafeEqual(keyBuf, expectedBuf)) {
      throw Object.assign(
        new Error("Invalid internal API key"),
        { code: "FORBIDDEN" },
      );
    }
  }

  private extractBearerToken(authorization: string | undefined): string | undefined {
    if (!authorization) return undefined;
    const parts = authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
    return undefined;
  }

  // ─── Storage ────────────────────────────────────────────

  @Get("storage/download-url")
  async getDownloadUrl(
    @Query("objectKey") objectKey: string,
    @Headers("X-Internal-Key") xInternalKey: string | undefined,
    @Headers("Authorization") authorization: string | undefined,
  ) {
    this.validateKey(xInternalKey, authorization);
    const result = await this.storage.generateDownloadUrl(objectKey);
    return { url: result.url, expiresInSeconds: result.expiresInSeconds };
  }

  // ─── Speech Jobs ────────────────────────────────────────

  @Put("speech-jobs/:jobId/result")
  async updateSpeechJobResult(
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() body: {
      status: string;
      result: Record<string, unknown>;
      confidence?: number;
      processingMs?: number;
      errorCode?: string;
    },
    @Headers("X-Internal-Key") xInternalKey: string | undefined,
    @Headers("Authorization") authorization: string | undefined,
  ) {
    this.validateKey(xInternalKey, authorization);

    const updated = await this.prisma.speechJob.update({
      where: { id: jobId },
      data: {
        status: body.status as "CREATED" | "QUALITY_CHECKED" | "REJECTED_AUDIO" | "PROCESSING" | "AUTO_RESULT" | "NEEDS_REVIEW" | "FINALIZED" | "FAILED",
        result: body.result as any,
        ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
        ...(body.processingMs !== undefined ? { processingMs: body.processingMs } : {}),
        ...(body.errorCode !== undefined ? { errorCode: body.errorCode } : {}),
      },
    });

    return { id: updated.id, status: updated.status };
  }

  // ─── Assessment Items ───────────────────────────────────

  @Put("assessment-items/:itemId/auto-result")
  async updateAssessmentItemAutoResult(
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() body: {
      autoResult: Record<string, unknown>;
      scoredScore: number;
    },
    @Headers("X-Internal-Key") xInternalKey: string | undefined,
    @Headers("Authorization") authorization: string | undefined,
  ) {
    this.validateKey(xInternalKey, authorization);

    const updated = await this.prisma.assessmentItem.update({
      where: { id: itemId },
      data: {
        autoResult: body.autoResult as any,
        scoredScore: body.scoredScore,
      },
      include: { session: { select: { id: true, schoolId: true } } },
    });

    // A report is created only after every oral item in this submitted attempt
    // has a real automatic result. Failed or review-required jobs deliberately
    // leave the attempt in processing; no placeholder score is produced.
    await this.assessmentService.finalizeAutomaticReportFromSpeechJob(
      updated.session.schoolId,
      updated.session.id,
    );

    return { id: updated.id, scoredScore: updated.scoredScore };
  }

  // ─── Recordings ─────────────────────────────────────────

  @Put("recordings/:recordingId/status")
  async updateRecordingStatus(
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @Body() body: { status: string },
    @Headers("X-Internal-Key") xInternalKey: string | undefined,
    @Headers("Authorization") authorization: string | undefined,
  ) {
    this.validateKey(xInternalKey, authorization);

    const updated = await this.prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: body.status as "INITIALIZED" | "UPLOADING" | "COMPLETE" | "PROCESSING" | "READY" | "FAILED",
      },
    });

    return { id: updated.id, status: updated.status };
  }

  // ─── AI Lesson Planning: Job Result ────────────────────

  @Put("ai-generation-jobs/:jobId/result")
  async updateAiGenerationJobResult(
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() body: {
      status: string;
      outputSnapshot?: Record<string, unknown>;
      errorCode?: string;
      tokenUsage?: Record<string, unknown>;
      latencyMs?: number;
      providerRequestId?: string;
    },
    @Headers("X-Internal-Key") xInternalKey: string | undefined,
    @Headers("Authorization") authorization: string | undefined,
  ) {
    this.validateKey(xInternalKey, authorization);
    await this.aiLessonPlanningService.updateJobResult(jobId, body);
    return { id: jobId, status: body.status };
  }

  // ─── AI Provider Proxy ─────────────────────────────────

  /**
   * Internal OpenAI-compatible proxy endpoint.
   *
   * Flowise calls this endpoint instead of the real AI provider directly.
   * The real AI_API_KEY is substituted server-side, never exposed to Flowise.
   *
   * Requires X-Internal-Key header for authentication.
   * Only forwards to the configured AI_BASE_URL.
   * Strips any API key from response headers.
   */
  @Post("ai/openai/v1/chat/completions")
  @HttpCode(200)
  async proxyOpenAiChatCompletions(
    @Body() body: Record<string, unknown>,
    @Headers("X-Internal-Key") xInternalKey: string | undefined,
    @Headers("Authorization") authorization: string | undefined,
    @Res() res: Response,
  ) {
    this.validateKey(xInternalKey, authorization);

    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;

    if (!baseUrl || !apiKey) {
      res.status(503).json({
        error: {
          message: "AI provider not configured",
          code: "PROVIDER_NOT_CONFIGURED",
        },
      });
      return;
    }

    const targetUrl = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

    const startTime = Date.now();
    let statusCode = 0;
    let tokenUsage: Record<string, unknown> | null = null;

    try {
      const controller = new AbortController();
      const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS ?? "120000", 10);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const upstream = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      statusCode = upstream.status;

      const responseText = await upstream.text();

      // Parse response to extract token usage (for audit logging)
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.usage) {
          tokenUsage = parsed.usage as Record<string, unknown>;
        }
        // Strip any API key from response
        if (typeof parsed === "object" && parsed !== null) {
          delete (parsed as Record<string, unknown>).apiKey;
        }
        res.status(statusCode).json(parsed);
      } catch {
        // If not valid JSON, forward as-is (could be SSE stream)
        res.status(statusCode).send(responseText);
      }

      // Audit log — no sensitive content logged
      const latencyMs = Date.now() - startTime;
      console.info(
        JSON.stringify({
          msg: "AI proxy request completed",
          statusCode,
          latencyMs,
          tokenUsage,
          // Do NOT log: prompt, completion, API key, or full request/response
        }),
      );
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";

      console.error(
        JSON.stringify({
          msg: "AI proxy request failed",
          latencyMs,
          error: errorMessage,
          // Do NOT log stack trace that might contain keys
        }),
      );

      if (errorMessage.includes("abort")) {
        res.status(504).json({
          error: {
            message: "AI provider request timed out",
            code: "AI_GENERATION_TIMEOUT",
          },
        });
      } else {
        res.status(502).json({
          error: {
            message: "AI provider request failed",
            code: "AI_PROVIDER_UNAVAILABLE",
          },
        });
      }
    }
  }
}
