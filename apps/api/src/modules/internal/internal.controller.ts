import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../common/security/public.decorator.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { StoragePort } from "../../shared/storage/storage.port.js";
import { STORAGE_PORT } from "../../shared/storage/storage.port.js";

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
    config: ConfigService,
  ) {
    this.internalKey = config.get<string>("API_INTERNAL_KEY") ?? "";
  }

  /**
   * Validate internal API key.
   */
  private validateKey(key: string | undefined): void {
    if (!this.internalKey) {
      // If no key configured, reject all internal requests
      throw Object.assign(
        new Error("Internal API key not configured"),
        { code: "PROVIDER_NOT_CONFIGURED" },
      );
    }
    if (key !== this.internalKey) {
      throw Object.assign(
        new Error("Invalid internal API key"),
        { code: "FORBIDDEN" },
      );
    }
  }

  // ─── Storage ────────────────────────────────────────────

  @Get("storage/download-url")
  async getDownloadUrl(
    @Query("objectKey") objectKey: string,
    @Headers("X-Internal-Key") key: string | undefined,
  ) {
    this.validateKey(key);
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
    @Headers("X-Internal-Key") key: string | undefined,
  ) {
    this.validateKey(key);

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
    @Headers("X-Internal-Key") key: string | undefined,
  ) {
    this.validateKey(key);

    const updated = await this.prisma.assessmentItem.update({
      where: { id: itemId },
      data: {
        autoResult: body.autoResult as any,
        scoredScore: body.scoredScore,
      },
    });

    return { id: updated.id, scoredScore: updated.scoredScore };
  }

  // ─── Recordings ─────────────────────────────────────────

  @Put("recordings/:recordingId/status")
  async updateRecordingStatus(
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @Body() body: { status: string },
    @Headers("X-Internal-Key") key: string | undefined,
  ) {
    this.validateKey(key);

    const updated = await this.prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: body.status as "INITIALIZED" | "UPLOADING" | "COMPLETE" | "PROCESSING" | "READY" | "FAILED",
      },
    });

    return { id: updated.id, status: updated.status };
  }
}
