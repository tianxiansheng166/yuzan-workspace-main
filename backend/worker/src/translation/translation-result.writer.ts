import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

/**
 * TranslationResultWriter updates the API with translation job results.
 *
 * It calls internal API endpoints to:
 * - Update TranslationJob status (PROCESSING / COMPLETED / FAILED / PROVIDER_UNAVAILABLE)
 * - Write machineResult and provider metadata on success
 * - Write errorCode on failure
 *
 * Security:
 * - machineResult is sent to API but never logged
 * - Logs contain only jobId, status, and errorCode
 */
export class TranslationResultWriter {
  private readonly apiBaseUrl: string;
  private readonly internalKey: string;

  constructor() {
    this.apiBaseUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.internalKey = process.env.API_INTERNAL_KEY ?? "";
  }

  /**
   * Update translation job status (e.g., PROCESSING).
   */
  async updateJobStatus(jobId: string, status: string): Promise<void> {
    await this.callApi(jobId, { status });
  }

  /**
   * Update translation job with full result on completion or failure.
   */
  async updateJobResult(
    jobId: string,
    data: {
      status: string;
      machineResult?: string;
      provider?: string;
      providerRequestId?: string;
      providerModel?: string;
      providerLatencyMs?: number;
      errorCode?: string;
    },
  ): Promise<void> {
    await this.callApi(jobId, data);

    // Safe log: no machineResult, only metadata
    if (data.status === "COMPLETED") {
      logger.info(
        { jobId, status: data.status, provider: data.provider, latencyMs: data.providerLatencyMs },
        "Translation result written to API",
      );
    } else {
      logger.error(
        { jobId, status: data.status, errorCode: data.errorCode },
        "Translation result written to API",
      );
    }
  }

  private async callApi(
    jobId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/internal/translation-jobs/${jobId}/result`,
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
        const errorBody = await response.text().catch(() => "");
        logger.error(
          { jobId, status: response.status, errorBody: errorBody.slice(0, 200) },
          "Failed to update translation job result",
        );
      }
    } catch (error: unknown) {
      logger.error(
        { jobId, error: error instanceof Error ? error.message : String(error) },
        "Failed to update translation job result (network error)",
      );
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
