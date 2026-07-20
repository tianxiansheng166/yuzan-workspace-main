import { Worker, type Job } from "bullmq";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export interface SpeechJobPayload {
  speechJobId: string;
  recordingId: string;
  assessmentItemId: string;
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
 * 3. Update SpeechJob result via API
 * 4. Update AssessmentItem autoResult and scoredScore
 * 5. Update Recording status to READY
 * 6. On failure, update error and retry count
 */
export class SpeechJobConsumer {
  private worker: Worker<SpeechJobPayload> | null = null;
  private readonly speechApiUrl: string;
  private readonly apiBaseUrl: string;
  private readonly apiInternalKey: string;

  constructor(
    private readonly queueName: string,
    private readonly connection: { host: string; port: number },
  ) {
    this.speechApiUrl = process.env.SPEECH_API_URL ?? "http://127.0.0.1:8100";
    this.apiBaseUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.apiInternalKey = process.env.API_INTERNAL_KEY ?? "";
  }

  start(): void {
    this.worker = new Worker<SpeechJobPayload>(
      this.queueName,
      async (job: Job<SpeechJobPayload>) => {
        logger.info({ jobId: job.id, speechJobId: job.data.speechJobId }, "Processing speech job");
        await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 2,
        limiter: { max: 1, duration: 5000 },
      },
    );

    this.worker.on("completed", (job: Job<SpeechJobPayload>) => {
      logger.info({ jobId: job.id, speechJobId: job.data.speechJobId }, "Speech job completed");
    });

    this.worker.on("failed", (job: Job<SpeechJobPayload> | undefined, err: Error) => {
      logger.error(
        { jobId: job?.id, speechJobId: job?.data.speechJobId, error: err.message },
        "Speech job failed",
      );
    });

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
    const { speechJobId, recordingId, assessmentItemId, schoolId, targetText, scorerVersion, objectKey } = job.data;

    try {
      // Step 1: Generate download URL for recording
      const downloadUrl = await this.getRecordingDownloadUrl(objectKey);

      // Step 2: Call Python speech scoring service
      const scoringResult = await this.callSpeechScoring(downloadUrl, targetText, scorerVersion);

      // Step 3: Update results via API (must succeed — throws on failure)
      await this.updateSpeechJobResult(speechJobId, {
        status: scoringResult.requiresReview ? "NEEDS_REVIEW" : "AUTO_RESULT",
        result: scoringResult,
        confidence: scoringResult.confidence,
        ...(scoringResult.processingMs !== undefined ? { processingMs: scoringResult.processingMs } : {}),
      });

      // Step 4: Update AssessmentItem with auto result and score (if linked)
      if (assessmentItemId) {
        await this.updateAssessmentItem(assessmentItemId, {
          autoResult: scoringResult,
          scoredScore: scoringResult.scores.overall,
        });
      }

      // Step 5: Update Recording status to READY
      await this.updateRecordingStatus(recordingId, "READY");

      logger.info(
        { speechJobId, overall: scoringResult.scores.overall, requiresReview: scoringResult.requiresReview },
        "Speech scoring completed",
      );
    } catch (err) {
      // Attempt to mark the SpeechJob as FAILED so it doesn't appear as completed
      try {
        await this.markSpeechJobFailed(speechJobId, err instanceof Error ? err.message : String(err));
      } catch (markFailedErr) {
        logger.error(
          { speechJobId, markFailedErr: markFailedErr instanceof Error ? markFailedErr.message : String(markFailedErr) },
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
      throw new Error(`Failed to get download URL: ${response.status} ${await response.text()}`);
    }
    // API responses are wrapped in { data: { ... }, meta: { ... } }
    const json = await response.json() as { data?: { url: string }; url?: string };
    const url = json.data?.url ?? json.url;
    if (!url) {
      throw new Error(`Download URL not found in response: ${JSON.stringify(json)}`);
    }
    return url;
  }

  private async callSpeechScoring(
    audioUrl: string,
    targetText: string,
    scorerVersion: string,
  ): Promise<SpeechScoringResult> {
    const response = await fetch(`${this.speechApiUrl}/v1/score/reading`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioUrl,
        targetText,
        language: "zh-CN",
        scorerVersion,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Speech scoring service error: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<SpeechScoringResult>;
  }

  private async updateSpeechJobResult(
    speechJobId: string,
    data: { status: string; result: SpeechScoringResult; confidence: number; processingMs?: number },
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

  private async updateAssessmentItem(
    assessmentItemId: string,
    data: { autoResult: SpeechScoringResult; scoredScore: number },
  ): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/internal/assessment-items/${assessmentItemId}/auto-result`,
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
        `Failed to update assessment item: status=${response.status} body=${errorBody}`,
      );
    }
  }

  private async updateRecordingStatus(recordingId: string, status: string): Promise<void> {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/internal/recordings/${recordingId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...this.getInternalHeaders(),
        },
        body: JSON.stringify({ status }),
      },
    );
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Failed to update recording status: status=${response.status} body=${errorBody}`,
      );
    }
  }

  /**
   * Attempt to mark a SpeechJob as FAILED after all retries are exhausted.
   * This prevents the job from appearing as "completed" when it actually failed.
   */
  private async markSpeechJobFailed(speechJobId: string, errorMessage: string): Promise<void> {
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

export interface SpeechScoringResult {
  scorerVersion: string;
  transcript: string;
  confidence: number;
  scores: {
    accuracy: number;
    completeness: number;
    fluency: number;
    tone: number | null;
    overall: number;
  };
  errors: Array<{
    text: string;
    pinyin: string;
    startMs: number;
    endMs: number;
    type: string;
    score: number;
  }>;
  requiresReview: boolean;
  processingMs?: number;
  toneMeta?: {
    experimental: boolean;
    method: string | null;
    reason: string | null;
  };
}
