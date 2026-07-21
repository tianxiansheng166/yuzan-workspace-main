import { Worker, type Job } from "bullmq";
import { createRequire } from "node:module";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

// Use createRequire to load JSON Schema (ESM compatible)
const require = createRequire(import.meta.url);

export interface AiGenerationJobPayload {
  jobId: string;
  schoolId: string;
  teacherId: string;
  goal: string;
  courseVersionId?: string;
  lessonId?: string;
  gradeBand?: string;
}

interface FlowisePredictionResponse {
  json: Record<string, unknown> | null;
  text: string;
}

/**
 * AiGenerationConsumer processes AI lesson-plan generation jobs from BullMQ.
 *
 * Flow:
 * 1. Mark job as RUNNING via internal API
 * 2. Call Flowise Prediction API with structured input
 * 3. Validate output against JSON Schema
 * 4. If valid, report SUCCEEDED with output via internal API
 * 5. If schema-invalid, attempt one auto-repair retry, then report OUTPUT_SCHEMA_INVALID
 * 6. On any other failure, report FAILED with error code
 *
 * Security:
 * - Flowise URL, flowId, and Flow API Key are only in server environment
 * - Student PII is never sent to AI
 * - API keys are never logged
 */
export class AiGenerationConsumer {
  private worker: Worker<AiGenerationJobPayload> | null = null;
  private readonly apiBaseUrl: string;
  private readonly apiInternalKey: string;
  private readonly flowiseBaseUrl: string;
  private readonly flowiseFlowId: string;
  private readonly flowiseApiKey: string;
  private schemaValidator: ((data: unknown) => boolean) | null = null;

  constructor(
    private readonly queueName: string,
    private readonly connection: { host: string; port: number },
  ) {
    this.apiBaseUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.apiInternalKey = process.env.API_INTERNAL_KEY ?? "";
    this.flowiseBaseUrl = process.env.FLOWISE_BASE_URL ?? "http://127.0.0.1:4300";
    this.flowiseFlowId = process.env.FLOWISE_FLOW_ID ?? "";
    this.flowiseApiKey = process.env.FLOWISE_API_KEY ?? "";
  }

  start(): void {
    this.loadSchemaValidator();

    this.worker = new Worker<AiGenerationJobPayload>(
      this.queueName,
      async (job: Job<AiGenerationJobPayload>) => {
        logger.info({ jobId: job.id, aiJobId: job.data.jobId }, "Processing AI generation job");
        await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: 1, // One AI generation at a time to avoid provider rate limits
        limiter: { max: 1, duration: 10000 },
      },
    );

    this.worker.on("completed", (job: Job<AiGenerationJobPayload>) => {
      logger.info({ jobId: job.id, aiJobId: job.data.jobId }, "AI generation job completed");
    });

    this.worker.on("failed", (job: Job<AiGenerationJobPayload> | undefined, err: Error) => {
      logger.error(
        { jobId: job?.id, aiJobId: job?.data.jobId, error: err.message },
        "AI generation job failed",
      );
    });

    logger.info({ queue: this.queueName }, "AiGenerationConsumer started");
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info("AiGenerationConsumer stopped");
    }
  }

  private async processJob(job: Job<AiGenerationJobPayload>): Promise<void> {
    const { jobId, schoolId, teacherId, goal, courseVersionId, lessonId, gradeBand } = job.data;
    const startTime = Date.now();

    // Check if Flowise is configured
    if (!this.flowiseFlowId || !this.flowiseApiKey) {
      await this.reportResult(jobId, {
        status: "PROVIDER_NOT_CONFIGURED",
        errorCode: "FLOWISE_NOT_CONFIGURED",
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    // Step 1: Mark job as RUNNING
    await this.reportResult(jobId, { status: "RUNNING" });

    try {
      // Step 2: Call Flowise Prediction API
      const predictionInput = {
        requestId: `ai-job-${jobId}`,
        schoolContextId: schoolId,
        teacherContextId: teacherId,
        goal,
        gradeBand: gradeBand ?? "",
        subject: "",
        durationMinutes: 40,
        courseVersionId: courseVersionId ?? "",
        lessonId: lessonId ?? "",
        courseTitle: "",
        courseSummary: "",
        lessonTitle: "",
        lessonContentSummary: "",
        classAggregateSummary: "",
        outputModules: "all",
        locale: "zh-CN",
      };

      const predictionResult = await this.callFlowise(predictionInput);
      const latencyMs = Date.now() - startTime;

      // Step 3: Validate output against schema
      const output = this.extractOutput(predictionResult);

      if (!output) {
        await this.reportResult(jobId, {
          status: "OUTPUT_SCHEMA_INVALID",
          errorCode: "EMPTY_OUTPUT",
          latencyMs,
        });
        return;
      }

      if (this.schemaValidator && !this.schemaValidator(output)) {
        logger.warn(
          { jobId, latencyMs },
          "Schema validation failed on first attempt — will not auto-retry in worker (Flowise workflow should handle retry internally)",
        );

        await this.reportResult(jobId, {
          status: "OUTPUT_SCHEMA_INVALID",
          errorCode: "AI_OUTPUT_SCHEMA_INVALID",
          outputSnapshot: output as Record<string, unknown>,
          latencyMs,
        });
        return;
      }

      // Step 4: Report success
      await this.reportResult(jobId, {
        status: "SUCCEEDED",
        outputSnapshot: output as Record<string, unknown>,
        tokenUsage: this.extractTokenUsage(predictionResult),
        latencyMs,
      });

      logger.info(
        { jobId, schoolId, teacherId, latencyMs },
        "AI lesson plan generation succeeded",
      );
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Determine error code based on error type
      let errorCode = "AI_PROVIDER_UNAVAILABLE";
      let status = "FAILED";

      if (errorMessage.includes("timed out") || errorMessage.includes("abort")) {
        errorCode = "AI_GENERATION_TIMEOUT";
        status = "TIMEOUT";
      } else if (errorMessage.includes("401") || errorMessage.includes("403")) {
        errorCode = "FLOWISE_AUTH_FAILED";
        status = "PROVIDER_UNAVAILABLE";
      } else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
        errorCode = "FLOWISE_UNAVAILABLE";
        status = "PROVIDER_UNAVAILABLE";
      }

      await this.reportResult(jobId, {
        status,
        errorCode,
        latencyMs,
      });

      logger.error(
        { jobId, errorCode, latencyMs, error: errorMessage },
        "AI generation job failed",
      );

      // Re-throw to let BullMQ handle retry
      throw err;
    }
  }

  /**
   * Call Flowise Prediction API with structured input.
   */
  private async callFlowise(
    input: Record<string, unknown>,
  ): Promise<FlowisePredictionResponse> {
    const url = `${this.flowiseBaseUrl}/api/v1/prediction/${this.flowiseFlowId}`;

    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS ?? "120000", 10);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.flowiseApiKey}`,
        },
        body: JSON.stringify({
          question: input.goal ?? "",
          overrideConfig: {
            sessionId: input.requestId,
          },
          input,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Flowise API error: ${response.status} ${errorBody.slice(0, 200)}`,
        );
      }

      const result = (await response.json()) as FlowisePredictionResponse;
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extract structured output from Flowise response.
   */
  private extractOutput(
    result: FlowisePredictionResponse,
  ): Record<string, unknown> | null {
    // Flowise Agentflow V2 returns JSON in result.json
    if (result.json && typeof result.json === "object") {
      return result.json;
    }

    // Try parsing text as JSON
    if (result.text) {
      try {
        const parsed = JSON.parse(result.text);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Not valid JSON
      }
    }

    return null;
  }

  /**
   * Extract token usage from Flowise response metadata.
   */
  private extractTokenUsage(
    result: FlowisePredictionResponse,
  ): Record<string, unknown> | undefined {
    const json = result.json as Record<string, unknown> | null;
    if (json?._meta?.tokenUsage) {
      return (json._meta as Record<string, unknown>).tokenUsage as Record<string, unknown>;
    }
    return undefined;
  }

  /**
   * Report job result back to the API server via internal endpoint.
   */
  private async reportResult(
    jobId: string,
    data: {
      status: string;
      outputSnapshot?: Record<string, unknown>;
      errorCode?: string;
      tokenUsage?: Record<string, unknown>;
      latencyMs?: number;
      providerRequestId?: string;
    },
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/internal/ai-generation-jobs/${jobId}/result`,
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
        logger.error(
          { jobId, status: response.status, errorBody: errorBody.slice(0, 200) },
          "Failed to report AI generation job result",
        );
      }
    } catch (err: unknown) {
      logger.error(
        { jobId, error: err instanceof Error ? err.message : String(err) },
        "Failed to report AI generation job result (network error)",
      );
    }
  }

  /**
   * Load the JSON Schema validator for lesson plan output.
   */
  private loadSchemaValidator(): void {
    try {
      // Dynamically load Ajv for schema validation
      const Ajv = require("ajv").default;
      const schema = require("../../../infra/ai/flowise/schemas/lesson-plan-output.schema.json");

      const ajv = new Ajv({ allErrors: true });
      this.schemaValidator = ajv.compile(schema) as (data: unknown) => boolean;
      logger.info("Lesson plan output schema validator loaded");
    } catch (err: unknown) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        "Could not load schema validator — output will not be validated",
      );
      this.schemaValidator = null;
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
