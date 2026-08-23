import pino from "pino";
import type { SpeechProviderResult } from "./speech-provider.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

/**
 * SpeechResultWriter updates the API with speech scoring results.
 *
 * The SpeechJob callback is the single result authority. The API validates the
 * provider result and performs the safe AssessmentItem/Recording writes; this
 * writer never sends a scoredScore.
 */
export class SpeechResultWriter {
  private readonly apiBaseUrl: string;
  private readonly internalKey: string;

  constructor() {
    const configuredApiBase =
      process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.apiBaseUrl = configuredApiBase.replace(/\/api\/v1\/internal\/?$/, "");
    this.internalKey = process.env.API_INTERNAL_KEY ?? "";
  }

  /**
   * Write speech scoring results back to the API.
   */
  async writeResults(params: {
    speechJobId: string;
    recordingId: string;
    assessmentItemId: string;
    result: SpeechProviderResult;
    processingMs: number;
  }): Promise<void> {
    const { speechJobId, recordingId, assessmentItemId, result, processingMs } =
      params;

    // Update SpeechJob
    await this.updateSpeechJob(speechJobId, {
      result: result as unknown as Record<string, unknown>,
      confidence: result.confidence,
      processingMs,
    });

    logger.info(
      {
        speechJobId,
        recordingId,
        assessmentItemId,
        strategy: result.strategy,
        provider: result.provider,
        overall: result.scores?.overall,
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
      errorMessage,
    });

    logger.error(
      { speechJobId, recordingId, errorCode },
      "Speech job marked as failed",
    );
  }

  private async updateSpeechJob(
    speechJobId: string,
    data: {
      status?: string;
      result?: Record<string, unknown>;
      confidence?: number;
      processingMs?: number;
      errorCode?: string;
      errorMessage?: string;
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

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.internalKey) {
      headers["X-Internal-Key"] = this.internalKey;
    }
    return headers;
  }
}
