import pino from "pino";
import type { SpeechScoringResult } from "./speech-job.consumer.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

/**
 * SpeechResultWriter updates the API with speech scoring results.
 *
 * It calls internal API endpoints to:
 * - Update SpeechJob status and result
 * - Update AssessmentItem autoResult and scoredScore
 * - Update Recording status
 */
export class SpeechResultWriter {
  private readonly apiBaseUrl: string;
  private readonly internalKey: string;

  constructor() {
    this.apiBaseUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.internalKey = process.env.API_INTERNAL_KEY ?? "";
  }

  /**
   * Write speech scoring results back to the API.
   */
  async writeResults(params: {
    speechJobId: string;
    recordingId: string;
    assessmentItemId: string;
    result: SpeechScoringResult;
    processingMs: number;
  }): Promise<void> {
    const { speechJobId, recordingId, assessmentItemId, result, processingMs } = params;

    // Update SpeechJob
    await this.updateSpeechJob(speechJobId, {
      status: result.requiresReview ? "NEEDS_REVIEW" : "AUTO_RESULT",
      result: result as unknown as Record<string, unknown>,
      confidence: result.confidence,
      processingMs,
    });

    // Update AssessmentItem
    await this.updateAssessmentItem(assessmentItemId, {
      autoResult: result as unknown as Record<string, unknown>,
      scoredScore: result.scores.overall,
    });

    // Update Recording
    await this.updateRecordingStatus(recordingId, "READY");

    logger.info(
      {
        speechJobId,
        recordingId,
        assessmentItemId,
        overall: result.scores.overall,
        requiresReview: result.requiresReview,
      },
      "Speech results written to API",
    );
  }

  /**
   * Mark a SpeechJob as failed.
   */
  async markFailed(params: {
    speechJobId: string;
    recordingId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<void> {
    const { speechJobId, recordingId, errorCode, errorMessage } = params;

    await this.updateSpeechJob(speechJobId, {
      status: "FAILED",
      errorCode,
      result: { error: errorMessage } as unknown as Record<string, unknown>,
    });

    await this.updateRecordingStatus(recordingId, "FAILED");

    logger.error({ speechJobId, recordingId, errorCode }, "Speech job marked as failed");
  }

  private async updateSpeechJob(
    speechJobId: string,
    data: {
      status: string;
      result: Record<string, unknown>;
      confidence?: number;
      processingMs?: number;
      errorCode?: string;
    },
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/internal/speech-jobs/${speechJobId}/result`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...this.getHeaders(),
          },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        logger.error(
          { speechJobId, status: response.status },
          "Failed to update SpeechJob",
        );
      }
    } catch (error: unknown) {
      logger.error({ speechJobId, error }, "Error updating SpeechJob");
    }
  }

  private async updateAssessmentItem(
    assessmentItemId: string,
    data: { autoResult: Record<string, unknown>; scoredScore: number },
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/internal/assessment-items/${assessmentItemId}/auto-result`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...this.getHeaders(),
          },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        logger.error(
          { assessmentItemId, status: response.status },
          "Failed to update AssessmentItem",
        );
      }
    } catch (error: unknown) {
      logger.error({ assessmentItemId, error }, "Error updating AssessmentItem");
    }
  }

  private async updateRecordingStatus(
    recordingId: string,
    status: string,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/internal/recordings/${recordingId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...this.getHeaders(),
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        logger.error(
          { recordingId, status: response.status },
          "Failed to update Recording status",
        );
      }
    } catch (error: unknown) {
      logger.error({ recordingId, error }, "Error updating Recording status");
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.internalKey) {
      headers["X-Internal-Key"] = this.internalKey;
    }
    return headers;
  }
}