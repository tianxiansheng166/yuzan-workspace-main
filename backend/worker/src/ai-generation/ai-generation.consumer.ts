import { Worker, type Job } from "bullmq";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

// ESM-compatible path resolution for schema loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use createRequire for JSON loading (ESM compatible)
const require = createRequire(import.meta.url);

export interface AiGenerationJobPayload {
  jobId: string;
  schoolId: string;
  teacherId: string;
  goal: string;
  courseVersionId?: string;
  lessonId?: string;
  gradeBand?: string;
  subject?: string;
  durationMinutes?: number;
  keyRequirements?: string;
  outputModules?: string;
  locale?: string;
  courseTitle?: string;
  courseSummary?: string;
  lessonTitle?: string;
  lessonContentSummary?: string;
  classAggregateSummary?: string;
  /** externalFlowId from AiWorkflowDefinition — single source of truth (gap 5 fix) */
  externalFlowId?: string;
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
 * 2. Call Flowise Prediction API with { form, streaming, overrideConfig }
 * 3. Validate output against JSON Schema
 * 4. If valid, report SUCCEEDED with output via internal API
 * 5. If schema-invalid, report OUTPUT_SCHEMA_INVALID
 * 6. On any other failure, report FAILED with error code
 *
 * Security:
 * - Flowise URL, flowId, and Flow API Key are only in server environment
 * - Student PII is never sent to AI
 * - API keys are never logged
 *
 * Flowise Agentflow V2 Prediction API contract:
 *   POST /api/v1/prediction/{flowId}
 *   Body: { form: { ...fieldValues }, streaming: false, overrideConfig: { ... } }
 *   The `form` field maps to the Agentflow Form Input node's fields.
 */
export class AiGenerationConsumer {
  private worker: Worker<AiGenerationJobPayload> | null = null;
  private readonly apiBaseUrl: string;
  private readonly apiInternalKey: string;
  private readonly flowiseBaseUrl: string;
  private readonly flowiseFlowId: string;
  private readonly flowiseApiKey: string;
  private schemaValidator: (data: unknown) => boolean;

  constructor(
    private readonly queueName: string,
    private readonly connection: { host: string; port: number },
  ) {
    this.apiBaseUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
    this.apiInternalKey = process.env.API_INTERNAL_KEY ?? "";
    this.flowiseBaseUrl = process.env.FLOWISE_BASE_URL ?? "http://127.0.0.1:4300";
    this.flowiseFlowId = process.env.FLOWISE_FLOW_ID ?? "";
    this.flowiseApiKey = process.env.FLOWISE_API_KEY ?? "";

    // Schema validator must load successfully — crash if it fails
    this.schemaValidator = this.loadSchemaValidator();
  }

  start(): void {
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
    const {
      jobId,
      schoolId,
      teacherId,
      goal,
      courseVersionId,
      lessonId,
      gradeBand,
      subject,
      durationMinutes,
      keyRequirements,
      outputModules,
      locale,
      courseTitle,
      courseSummary,
      lessonTitle,
      lessonContentSummary,
      classAggregateSummary,
      externalFlowId,
    } = job.data;
    const startTime = Date.now();

    // Gap 5 fix: Use externalFlowId from payload (single source of truth from DB)
    // Fallback to env var only if payload doesn't carry it (backward compat)
    const resolvedFlowId = externalFlowId ?? this.flowiseFlowId;

    // Check if Flowise is configured
    if (!resolvedFlowId) {
      await this.reportResult(jobId, {
        status: "PROVIDER_NOT_CONFIGURED",
        errorCode: "FLOWISE_NOT_CONFIGURED",
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    logger.info(
      { jobId, resolvedFlowId, source: externalFlowId ? "payload" : "env" },
      "Resolved Flowise flow ID",
    );

    // Step 1: Mark job as RUNNING
    await this.reportResult(jobId, { status: "RUNNING" });

    try {
      // Step 2: Build form data for Flowise Agentflow V2 Form Input node
      const formPayload: Record<string, unknown> = {
        requestId: `ai-job-${jobId}`,
        schoolContextId: schoolId,
        teacherContextId: teacherId,
        goal,
        gradeBand: gradeBand ?? "",
        subject: subject ?? "",
        durationMinutes: durationMinutes ?? 40,
        keyRequirements: keyRequirements ?? "",
        outputModules: outputModules ?? "all",
        locale: locale ?? "zh-CN",
        courseVersionId: courseVersionId ?? "",
        lessonId: lessonId ?? "",
        courseTitle: courseTitle ?? "",
        courseSummary: courseSummary ?? "",
        lessonTitle: lessonTitle ?? "",
        lessonContentSummary: lessonContentSummary ?? "",
        classAggregateSummary: classAggregateSummary ?? "",
      };

      const predictionResult = await this.callFlowise(formPayload, resolvedFlowId);
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

      if (!this.schemaValidator(output)) {
        logger.warn(
          { jobId, latencyMs },
          "Schema validation failed — reporting OUTPUT_SCHEMA_INVALID",
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
      const tokenUsage = this.extractTokenUsage(predictionResult);
      const successData: {
        status: string;
        outputSnapshot: Record<string, unknown>;
        latencyMs: number;
        tokenUsage?: Record<string, unknown>;
      } = {
        status: "SUCCEEDED",
        outputSnapshot: output as Record<string, unknown>,
        latencyMs,
      };
      if (tokenUsage) {
        successData.tokenUsage = tokenUsage;
      }
      await this.reportResult(jobId, successData);

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
   * Call Flowise Prediction API with Agentflow V2 form input.
   *
   * Flowise Agentflow V2 expects:
   *   { form: { ...fieldValues }, streaming: false, overrideConfig: { ... } }
   *
   * NOT: { question, input, overrideConfig } — that is the legacy chatflow format.
   */
  private async callFlowise(
    form: Record<string, unknown>,
    flowId: string,
  ): Promise<FlowisePredictionResponse> {
    const url = `${this.flowiseBaseUrl}/api/v1/prediction/${flowId}`;

    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS ?? "120000", 10);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Flowise 3.1.1 requires x-request-from: internal for server-to-server API access
          "x-request-from": "internal",
          ...(this.flowiseApiKey ? { Authorization: `Bearer ${this.flowiseApiKey}` } : {}),
        },
        body: JSON.stringify({
          form,
          streaming: false,
          overrideConfig: {
            sessionId: `ai-job-${form.requestId ?? "unknown"}`,
          },
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
    const json = result.json as Record<string, unknown> | null | undefined;
    if (json && typeof json === "object" && "_meta" in json) {
      const meta = json._meta as Record<string, unknown> | undefined;
      if (meta && "tokenUsage" in meta) {
        return meta.tokenUsage as Record<string, unknown>;
      }
    }
    return undefined;
  }

  /**
   * Report job result back to the API server via internal endpoint.
   *
   * Gap 7 fix: If the report fails (non-2xx or network error), we throw
   * so that BullMQ retries the entire job. Silently swallowing failures
   * causes Jobs to permanently appear as RUNNING/QUEUED.
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
        const errMsg = `Report failed: API returned ${response.status} for job ${jobId}`;
        logger.error(
          { jobId, status: response.status, errorBody: errorBody.slice(0, 200) },
          errMsg,
        );
        // Throw to let BullMQ retry — prevents permanent RUNNING/QUEUED
        throw new Error(errMsg);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        { jobId, error: errorMessage },
        "Failed to report AI generation job result",
      );
      // Re-throw: if we swallow this, the Job stays permanently stuck
      throw err;
    }
  }

  /**
   * Load the JSON Schema validator for lesson plan output.
   *
   * CRITICAL: If the schema cannot be loaded, the Worker MUST crash.
   * Running without schema validation allows invalid AI output to be
   * persisted as lesson drafts — a data integrity violation.
   *
   * Uses import.meta.url + fileURLToPath for ESM-compatible path resolution
   * instead of relative require paths that break in bundled contexts.
   */
  private loadSchemaValidator(): (data: unknown) => boolean {
    const schemaPath = join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "infra",
      "ai",
      "flowise",
      "schemas",
      "lesson-plan-output.schema.json",
    );

    try {
      const AjvModule = require("ajv");
      const Ajv = AjvModule.default ?? AjvModule;
      const schema = require(schemaPath);

      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema) as (data: unknown) => boolean;
      logger.info({ schemaPath }, "Lesson plan output schema validator loaded");
      return validate;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.fatal(
        { schemaPath, error: message },
        "FATAL: Could not load schema validator — Worker cannot start without output validation. " +
        "Ensure lesson-plan-output.schema.json exists at the expected path.",
      );
      throw new Error(
        `FATAL: Schema validator load failed — ${message}. ` +
        "Worker must not run without output validation. " +
        `Expected schema at: ${schemaPath}`,
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
