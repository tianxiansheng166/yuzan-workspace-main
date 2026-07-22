import pino from "pino";
import type { SpeechScoringResult } from "./speech-job.consumer.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

/**
 * Client for the Python speech scoring service (FastAPI).
 *
 * Provides typed access to the /v1/score/reading endpoint.
 * Handles retries and timeout management.
 */
export class SpeechScoringClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    this.baseUrl = process.env.SPEECH_API_URL ?? "http://127.0.0.1:8100";
    this.timeoutMs = parseInt(process.env.SPEECH_API_TIMEOUT_MS ?? "60000", 10);
    this.maxRetries = parseInt(process.env.SPEECH_API_MAX_RETRIES ?? "2", 10);
  }

  /**
   * Score a reading recording against target text.
   *
   * @param audioUrl - Presigned download URL for the recording
   * @param targetText - The text the student was supposed to read
   * @param scorerVersion - Version of the scoring model to use
   * @param language - Language code (default: zh-CN)
   */
  async scoreReading(
    audioUrl: string,
    targetText: string,
    scorerVersion: string,
    language: string = "zh-CN",
  ): Promise<SpeechScoringResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(
          { attempt, scorerVersion, targetTextLength: targetText.length },
          "Calling speech scoring service",
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.baseUrl}/v1/score/reading`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioUrl,
            targetText,
            language,
            scorerVersion,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Speech scoring service returned ${response.status}: ${errorBody}`);
        }

        const result = (await response.json()) as SpeechScoringResult;
        logger.info(
          {
            scorerVersion: result.scorerVersion,
            overall: result.scores.overall,
            confidence: result.confidence,
            requiresReview: result.requiresReview,
          },
          "Speech scoring completed",
        );

        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { attempt, error: lastError.message, maxRetries: this.maxRetries },
          "Speech scoring attempt failed",
        );

        if (attempt < this.maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError ?? new Error("Speech scoring failed with no error captured");
  }

  /**
   * Health check for the speech scoring service.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
