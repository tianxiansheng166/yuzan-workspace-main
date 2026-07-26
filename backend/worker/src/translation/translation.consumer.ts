import { Worker, type Job } from "bullmq";
import pino from "pino";
import { TranslationResultWriter } from "./translation-result.writer.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

export interface TranslationJobPayload {
  jobId: string;
  schoolId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceTextEncrypted: string; // AES-GCM encrypted source text
  glossaryVersion: number;
}

interface TranslationProviderResult {
  resultText: string;
  provider: string;
  requestId: string;
  model: string;
}

/**
 * TranslationConsumer processes machine-translation jobs from BullMQ.
 *
 * Flow:
 * 1. Mark job as PROCESSING via internal API
 * 2. Decrypt sourceText (AES-GCM) — plaintext never logged
 * 3. Call translation provider adapter
 * 4. Report COMPLETED with machineResult + provider metadata
 * 5. On failure, classify error and report appropriate status
 *
 * Security:
 * - sourceText is decrypted in-memory only for the provider call
 * - Decrypted text is NEVER written to logs
 * - Logs contain only jobId, schoolId, status transitions, and latency
 *
 * Error classification:
 * - PROVIDER_UNAVAILABLE: network errors, 401/403 — retriable by BullMQ
 * - QUOTA_EXCEEDED: 429 — not retried (throws non-retriable error)
 * - INVALID_INPUT: 400 — not retried (throws non-retriable error)
 * - INTERNAL_ERROR: everything else — retriable by BullMQ
 */
export class TranslationConsumer {
  private worker: Worker<TranslationJobPayload> | null = null;
  private readonly apiBaseUrl: string;
  private readonly apiInternalKey: string;
  private readonly translationProviderUrl: string;
  private readonly cryptoKey: string;
  private readonly resultWriter: TranslationResultWriter;

  constructor(
    private readonly queueName: string,
    private readonly connection: { host: string; port: number },
  ) {
    this.apiBaseUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.apiInternalKey = process.env.API_INTERNAL_KEY ?? "";
    this.translationProviderUrl = process.env.TRANSLATION_PROVIDER_URL ?? "http://127.0.0.1:8200";
    this.cryptoKey = process.env.TRANSLATION_CRYPTO_KEY ?? "";
    this.resultWriter = new TranslationResultWriter();
  }

  start(): void {
    this.worker = new Worker<TranslationJobPayload>(
      this.queueName,
      async (job: Job<TranslationJobPayload>) => {
        logger.info({ jobId: job.id, translationJobId: job.data.jobId }, "Processing translation job");
        await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on("completed", (job: Job<TranslationJobPayload>) => {
      logger.info({ jobId: job.id, translationJobId: job.data.jobId }, "Translation job completed");
    });

    this.worker.on("failed", (job: Job<TranslationJobPayload> | undefined, err: Error) => {
      logger.error(
        { jobId: job?.id, translationJobId: job?.data.jobId, error: err.message },
        "Translation job failed",
      );
    });

    logger.info({ queue: this.queueName }, "TranslationConsumer started");
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info("TranslationConsumer stopped");
    }
  }

  private async processJob(job: Job<TranslationJobPayload>): Promise<void> {
    const { jobId, schoolId, sourceLanguage, targetLanguage, sourceTextEncrypted, glossaryVersion } = job.data;
    const startTime = Date.now();

    try {
      // Step 1: Mark job as PROCESSING
      await this.resultWriter.updateJobStatus(jobId, "PROCESSING");

      // Step 2: Decrypt source text — plaintext stays in memory only
      const sourceText = await this.decrypt(sourceTextEncrypted);

      // Step 3: Call translation provider
      const result = await this.callProvider(
        sourceLanguage,
        targetLanguage,
        sourceText,
        glossaryVersion,
      );
      const latencyMs = Date.now() - startTime;

      // Step 4: Report COMPLETED with result
      await this.resultWriter.updateJobResult(jobId, {
        status: "COMPLETED",
        machineResult: result.resultText,
        provider: result.provider,
        providerRequestId: result.requestId,
        providerModel: result.model,
        providerLatencyMs: latencyMs,
      });

      // Safe log: only metadata, never sourceText or resultText
      logger.info(
        { jobId, schoolId, provider: result.provider, latencyMs },
        "Translation succeeded",
      );
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof Error ? err : new Error(String(err));
      const errorCode = this.classifyError(error);

      const reportStatus = errorCode === "PROVIDER_UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : "FAILED";

      await this.resultWriter.updateJobResult(jobId, {
        status: reportStatus,
        errorCode,
      });

      logger.error(
        { jobId, schoolId, errorCode, latencyMs, error: error.message },
        "Translation job failed",
      );

      // Non-retriable errors: throw a marked error so BullMQ doesn't retry
      if (errorCode === "QUOTA_EXCEEDED" || errorCode === "INVALID_INPUT") {
        throw new Error(`NON_RETRIABLE:${errorCode}`);
      }

      // Retriable errors: re-throw to let BullMQ retry
      throw err;
    }
  }

  /**
   * Decrypt AES-GCM encrypted source text.
   *
   * Format matches API's AesGcmCrypto.encrypt():
   *   base64(iv[12 bytes] + ciphertext+tag) → WebCrypto decrypt
   *
   * The decrypted plaintext is used only for the provider call
   * and is NEVER logged or persisted.
   */
  private async decrypt(ciphertext: string): Promise<string> {
    if (!this.cryptoKey) {
      throw new Error("TRANSLATION_CRYPTO_KEY not configured");
    }

    try {
      // Decode the key from hex (32 bytes = 64 hex chars)
      const keyBytes = Buffer.from(this.cryptoKey, "hex");

      // Parse the ciphertext: format is base64(iv[12] + ciphertext+tag)
      const combined = Buffer.from(ciphertext, "base64");
      const iv = combined.subarray(0, 12);
      const encryptedData = combined.subarray(12);

      // Use WebCrypto API — matches AesGcmCrypto on the API side
      const algoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        algoKey,
        encryptedData,
      );

      return new TextDecoder().decode(decrypted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Decryption failed: ${message}`);
    }
  }

  /**
   * Call the translation provider adapter.
   */
  private async callProvider(
    sourceLanguage: string,
    targetLanguage: string,
    sourceText: string,
    glossaryVersion: number,
  ): Promise<TranslationProviderResult> {
    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.TRANSLATION_TIMEOUT_MS ?? "30000", 10);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${this.translationProviderUrl}/v1/translate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.getProviderHeaders(),
          },
          body: JSON.stringify({
            sourceLanguage,
            targetLanguage,
            text: sourceText,
            glossaryVersion,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const error: Error & { status?: number } = new Error(
          `Translation provider error: ${response.status} ${errorBody.slice(0, 200)}`,
        );
        error.status = response.status;
        throw error;
      }

      const result = (await response.json()) as TranslationProviderResult;
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private classifyError(error: Error & { code?: string; status?: number }): string {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") return "PROVIDER_UNAVAILABLE";
    if (error.status === 401 || error.status === 403) return "PROVIDER_UNAVAILABLE";
    if (error.status === 429) return "QUOTA_EXCEEDED";
    if (error.status === 400) return "INVALID_INPUT";
    return "INTERNAL_ERROR";
  }

  private getProviderHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const providerKey = process.env.TRANSLATION_PROVIDER_KEY ?? "";
    if (providerKey) {
      headers["Authorization"] = `Bearer ${providerKey}`;
    }
    return headers;
  }

  private getInternalHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiInternalKey) {
      headers["X-Internal-Key"] = this.apiInternalKey;
    }
    return headers;
  }
}
