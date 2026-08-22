import { Worker, type Job } from "bullmq";
import pino from "pino";
import { SpeechScoringClient } from "./speech-scoring.client.js";
import {
  configuredSpeechProvider,
  type SpeechProviderResult,
} from "./speech-provider.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export interface SpeechJobPayload {
  speechJobId: string;
  recordingId: string;
  assessmentItemId?: string;
  schoolId: string;
  targetText: string;
  scorerVersion: string;
  objectKey: string;
}

/**
 * SpeechJobConsumer processes speech scoring jobs from BullMQ.
 *
 * Flow:
 * 1. Download recording from MinIO
 * 2. Call Python speech scoring service
 * 3. Update the SpeechJob result through the server-side result policy
 * 4. The API writes the safe AssessmentItem diagnostic and Recording status
 * 5. On failure, update error and retry count
 */
export class SpeechJobConsumer {
  private worker: Worker<SpeechJobPayload> | null = null;
  private readonly apiBaseUrl: string;
  private readonly apiInternalKey: string;

  constructor(
    private readonly queueName: string,
    private readonly connection: { host: string; port: number },
    private readonly speechProvider = new SpeechScoringClient(),
  ) {
    const configuredApiBase =
      process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.apiBaseUrl = configuredApiBase.replace(/\/api\/v1\/internal\/?$/, "");
    this.apiInternalKey = process.env.API_INTERNAL_KEY ?? "";
  }

  start(): void {
    this.worker = new Worker<SpeechJobPayload>(
      this.queueName,
      async (job: Job<SpeechJobPayload>) => {
        logger.info(
          { jobId: job.id, speechJobId: job.data.speechJobId },
          "Processing speech job",
        );
        await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 2,
        limiter: { max: 1, duration: 5000 },
      },
    );

    this.worker.on("completed", (job: Job<SpeechJobPayload>) => {
      logger.info(
        { jobId: job.id, speechJobId: job.data.speechJobId },
        "Speech job completed",
      );
    });

    this.worker.on(
      "failed",
      (job: Job<SpeechJobPayload> | undefined, err: Error) => {
        logger.error(
          {
            jobId: job?.id,
            speechJobId: job?.data.speechJobId,
            error: err.message,
          },
          "Speech job failed",
        );
      },
    );

    logger.info({ queue: this.queueName }, "SpeechJobConsumer started");
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info("SpeechJobConsumer stopped");
    }
  }

  private async processJob(job: Job<SpeechJobPayload>): Promise<void> {
    const {
      speechJobId,
      recordingId,
      assessmentItemId,
      targetText,
      scorerVersion,
      objectKey,
    } = job.data;

    try {
      const provider = configuredSpeechProvider();
      if (provider !== "local") {
        throw new Error(
          "PROVIDER_NOT_CONFIGURED: speech worker requires SPEECH_PROVIDER=local",
        );
      }

      // Step 1: Generate download URL for recording
      const downloadUrl = await this.getRecordingDownloadUrl(objectKey);

      // Step 2: Call the configured local provider through the shared client.
      const scoringResult = await this.speechProvider.scoreReading(
        downloadUrl,
        targetText,
        scorerVersion,
      );

      // Step 3: The API validates the provider result, item strategy, target,
      // max score, and writes the safe diagnostic. The worker never sends a
      // scoredScore and cannot turn a 0–100 metric into a four-point score.
      await this.updateSpeechJobResult(speechJobId, {
        result: scoringResult,
        confidence: scoringResult.confidence,
        ...(scoringResult.processingMs !== undefined
          ? { processingMs: scoringResult.processingMs }
          : {}),
      });

      logger.info(
        {
          speechJobId,
          recordingId,
          assessmentItemId,
          provider: scoringResult.provider,
          overall: scoringResult.scores.overall,
          requiresReview: scoringResult.requiresReview,
        },
        "Speech scoring completed",
      );
    } catch (err) {
      // Attempt to mark the SpeechJob as FAILED so it doesn't appear as completed
      try {
        await this.markSpeechJobFailed(
          speechJobId,
          err instanceof Error ? err.message : String(err),
        );
      } catch (markFailedErr) {
        logger.error(
          {
            speechJobId,
            markFailedErr:
              markFailedErr instanceof Error
                ? markFailedErr.message
                : String(markFailedErr),
          },
          "Failed to mark speech job as FAILED after processing error",
        );
      }
      // Re-throw to let BullMQ handle retry
      throw err;
    }
  }

  private async getRecordingDownloadUrl(objectKey: string): Promise<string> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/internal/storage/download-url?objectKey=${encodeURIComponent(objectKey)}`,
      {
        headers: this.getInternalHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to get download URL: ${response.status} ${await response.text()}`,
      );
    }
    // API responses are wrapped in { data: { ... }, meta: { ... } }
    const json = (await response.json()) as {
      data?: { url: string };
      url?: string;
    };
    const url = json.data?.url ?? json.url;
    if (!url) {
      throw new Error(
        `Download URL not found in response: ${JSON.stringify(json)}`,
      );
    }
    return url;
  }

  private async updateSpeechJobResult(
    speechJobId: string,
    data: {
      result: SpeechProviderResult;
      confidence: number;
      processingMs?: number;
    },
  ): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/internal/speech-jobs/${speechJobId}/result`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...this.getInternalHeaders(),
        },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Failed to update speech job result: status=${response.status} body=${errorBody}`,
      );
    }
  }

  /**
   * Attempt to mark a SpeechJob as FAILED after all retries are exhausted.
   * This prevents the job from appearing as "completed" when it actually failed.
   */
  private async markSpeechJobFailed(
    speechJobId: string,
    errorMessage: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/internal/speech-jobs/${speechJobId}/result`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...this.getInternalHeaders(),
        },
        body: JSON.stringify({
          status: "FAILED",
          errorCode: "PROCESSING_FAILED",
          errorMessage,
        }),
      },
    );
    if (!response.ok) {
      logger.error(
        { speechJobId, status: response.status },
        "Failed to mark speech job as FAILED",
      );
    }
  }

  private getInternalHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiInternalKey) {
      headers["X-Internal-Key"] = this.apiInternalKey;
    }
    return headers;
  }
}

// Kept as a compatibility type alias for existing worker tests/importers while
// the provider-neutral contract lives in its own module.
export type { SpeechProviderResult as SpeechScoringResult } from "./speech-provider.js";
