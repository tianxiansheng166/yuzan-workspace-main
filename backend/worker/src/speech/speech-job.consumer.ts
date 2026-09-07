import { Worker, type Job } from "bullmq";
import pino from "pino";
import { prepareSpeechAudio } from "./audio-preparation.js";
import { SpeechScoringClient } from "./speech-scoring.client.js";
import {
  createSpeechReadingProvider,
  type SpeechReadingProviderFactory,
} from "./speech-provider.factory.js";
import {
  configuredSpeechProvider,
  SPEECH_OPEN_RESPONSE_STRATEGY,
  SPEECH_READING_STRATEGY,
  SpeechProviderConfigurationError,
  SpeechProviderTaskError,
  type SpeechTaskStrategy,
  type SpeechProviderResult,
} from "./speech-provider.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export interface SpeechJobPayload {
  speechJobId: string;
  recordingId: string;
  assessmentItemId?: string;
  schoolId: string;
  /** Required only for the server-authorized SPEECH_READING task. */
  targetText?: string;
  /** Derived by the API from QuestionBankItemVersion.scoringSpec. */
  strategy?: SpeechTaskStrategy;
  scorerVersion: string;
  objectKey: string;
}

/**
 * SpeechJobConsumer processes speech scoring jobs from BullMQ.
 *
 * Flow:
 * 1. Download recording from MinIO
 * 2. Normalize audio and call the selected reading provider adapter
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
    private readonly providerFactory: SpeechReadingProviderFactory = createSpeechReadingProvider,
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
      strategy,
      scorerVersion,
      objectKey,
    } = job.data;

    try {
      const provider = configuredSpeechProvider();
      if (provider === "disabled") {
        throw new SpeechProviderConfigurationError(
          "PROVIDER_NOT_CONFIGURED: SPEECH_PROVIDER=disabled",
        );
      }

      // Step 1: Generate download URL for recording
      const downloadUrl = await this.getRecordingDownloadUrl(objectKey);

      // Step 2: Route by the API-supplied task strategy. The API remains the
      // authority and checks this route against the immutable scoringSpec on
      // callback; the browser never selects it.
      const taskStrategy = strategy ?? SPEECH_READING_STRATEGY;
      let scoringResult: SpeechProviderResult;
      if (taskStrategy === SPEECH_OPEN_RESPONSE_STRATEGY) {
        if (provider !== "local") {
          throw new SpeechProviderTaskError(
            `PROVIDER_STRATEGY_UNSUPPORTED: ${provider} providers only support SPEECH_READING`,
          );
        }
        if (targetText?.trim()) {
          throw new SpeechProviderTaskError(
            "SPEECH_OPEN_RESPONSE must not carry targetText",
          );
        }
        scoringResult = await this.speechProvider.analyzeOpenResponse(
          downloadUrl,
          scorerVersion,
        );
      } else if (taskStrategy === SPEECH_READING_STRATEGY) {
        if (!targetText?.trim()) {
          throw new SpeechProviderTaskError("SPEECH_READING requires targetText");
        }
        if (provider === "local") {
          scoringResult = await this.speechProvider.scoreReading(
            downloadUrl,
            targetText,
            scorerVersion,
          );
        } else {
          const cloudProvider = this.providerFactory(provider);
          if (!cloudProvider.configured()) {
            throw new SpeechProviderConfigurationError(
              `PROVIDER_NOT_CONFIGURED: ${provider} credentials are not present`,
            );
          }
          const prepared = await prepareSpeechAudio(downloadUrl);
          scoringResult = await cloudProvider.scoreReading({
            audio: prepared.data,
            audioUrl: downloadUrl,
            targetText,
            language: "zh-CN",
            requestId: speechJobId,
          });
        }
      } else {
        throw new SpeechProviderTaskError(
          `Unsupported speech task strategy: ${String(taskStrategy)}`,
        );
      }

      const callbackResult = {
        ...scoringResult,
        strategy: taskStrategy,
      };

      // Step 3: The API validates the provider result, item strategy, target,
      // max score, and writes the safe diagnostic. The worker never sends a
      // scoredScore and cannot turn a 0–100 metric into a four-point score.
      await this.updateSpeechJobResult(speechJobId, {
        result: callbackResult,
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
          strategy: taskStrategy,
          provider: scoringResult.provider,
          overall: scoringResult.scores?.overall,
          requiresReview: scoringResult.requiresReview,
        },
        "Speech scoring completed",
      );
    } catch (err) {
      // Unsupported task routing is a stable, non-audio failure: the API must
      // keep the uploaded Recording available for teacher review.
      try {
        const errorCode =
          err instanceof SpeechProviderTaskError
            ? err.code
            : "PROCESSING_FAILED";
        await this.markSpeechJobFailed(
          speechJobId,
          errorCode,
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
      // Cloud adapters classify auth, invalid reference, bad audio, quota, and
      // unsupported strategy failures as non-transient. Do not spend BullMQ
      // attempts (or provider quota) retrying those failures.
      const nonRetryable =
        err instanceof SpeechProviderConfigurationError ||
        (typeof err === "object" &&
          err !== null &&
          "retryable" in err &&
          (err as { retryable?: unknown }).retryable === false);
      if (nonRetryable) return;
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
    errorCode: string,
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
          errorCode,
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
