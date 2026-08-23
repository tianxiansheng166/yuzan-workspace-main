import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import type { SpeechJobStatus } from "@yuzan/database";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { toSpeechJobResponse } from "./dto/speech-job.response.js";
import { SPEECH_QUEUE } from "./speech-job.tokens.js";
import {
  SpeechJobNotFoundException,
  SpeechJobResultConflictException,
  SpeechJobStrategyMismatchException,
  SpeechProviderNotConfiguredException,
} from "./domain/speech-job.errors.js";
import {
  buildOpenResponsePolicyResult,
  buildReadAloudPolicyResult,
  OPEN_RESPONSE_STRATEGY,
  READ_ALOUD_STRATEGY,
} from "./speech-result.policy.js";

type JsonRecord = Record<string, unknown>;
type SpeechTask = {
  strategy: typeof READ_ALOUD_STRATEGY | typeof OPEN_RESPONSE_STRATEGY;
  targetText?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strategyOf(value: unknown): string | undefined {
  return isRecord(value) ? stringField(value.strategy) : undefined;
}

function targetTextOf(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return stringField(value.targetText);
}

function targetTextFromPrompt(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!isRecord(value)) return undefined;
  const stimulus = value.stimulus;
  const stimulusFields = isRecord(stimulus) ? stimulus : undefined;
  return [
    value.targetText,
    value.promptText,
    value.text,
    value.sentence,
    typeof stimulus === "string" ? stimulus : undefined,
    stimulusFields?.targetText,
    stimulusFields?.promptText,
    stimulusFields?.text,
    stimulusFields?.sentence,
  ]
    .map(stringField)
    .find(Boolean);
}

const TERMINAL_SPEECH_JOB_STATUSES = new Set<SpeechJobStatus>([
  "AUTO_RESULT",
  "NEEDS_REVIEW",
  "FINALIZED",
]);

/**
 * SpeechJobService manages the lifecycle of speech processing jobs.
 *
 * A SpeechJob is created when a recording needs speech evaluation (e.g. pronunciation
 * scoring). The job transitions through states: CREATED -> PROCESSING -> AUTO_RESULT /
 * NEEDS_REVIEW / FINALIZED / FAILED.
 *
 * When SPEECH_PROVIDER=disabled, jobs are created but not dispatched to a queue;
 * they remain in CREATED status until an external system picks them up.
 */
@Injectable()
export class SpeechJobService {
  private readonly logger = new Logger(SpeechJobService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Optional()
    @Inject(SPEECH_QUEUE)
    private readonly speechQueue: Queue | null,
  ) {}

  /**
   * Create a SpeechJob linked to a recording and an assessment item.
   */
  async createSpeechJob(data: {
    recordingId: string;
    assessmentItemId: string;
    targetText?: string;
    schoolId: string;
    scorerVersion?: string;
    provider?: string;
  }) {
    const job = await this.prisma.speechJob.create({
      data: {
        recordingId: data.recordingId,
        assessmentItemId: data.assessmentItemId,
        schoolId: data.schoolId,
        targetText: data.targetText ?? null,
        status: "CREATED",
        ...(data.scorerVersion ? { scorerVersion: data.scorerVersion } : {}),
        ...(data.provider ? { provider: data.provider } : {}),
      },
    });

    this.logger.log(
      `SpeechJob created: id=${job.id} recordingId=${data.recordingId} assessmentItemId=${data.assessmentItemId}`,
    );

    return toSpeechJobResponse(job);
  }

  /**
   * Get a SpeechJob by ID.
   */
  async getSpeechJob(id: string, options: { includeResult?: boolean } = {}) {
    const job = await this.prisma.speechJob.findUnique({ where: { id } });
    if (!job) {
      throw new SpeechJobNotFoundException(`SpeechJob ${id} not found`);
    }
    return toSpeechJobResponse(job, options);
  }

  /**
   * List all SpeechJobs for a given assessment item.
   */
  async listSpeechJobsByItem(
    assessmentItemId: string,
    options: { includeResult?: boolean } = {},
  ) {
    const jobs = await this.prisma.speechJob.findMany({
      where: { assessmentItemId },
      orderBy: { createdAt: "desc" },
    });
    return jobs.map((job) => toSpeechJobResponse(job, options));
  }

  /**
   * Apply a provider result through the server-side Question Bank policy.
   *
   * The callback carries no scoredScore. This method validates the persisted
   * SpeechJob → Recording → AssessmentItem → QuestionBankItemVersion chain,
   * computes a bounded learning diagnostic, and keeps the formal score null
   * for every uncalibrated provider; provider-specific raw evidence remains
   * server-side and the formal scoredScore stays null.
   */
  async applySpeechProviderResult(id: string, providerResult: unknown) {
    const job = await this.prisma.speechJob.findUnique({
      where: { id },
      include: {
        recording: { select: { id: true, schoolId: true } },
        assessmentItem: {
          select: {
            id: true,
            recordingId: true,
            maxScore: true,
            scoredScore: true,
            questionVersionId: true,
            session: { select: { id: true, schoolId: true } },
            questionVersion: { select: { status: true, scoringSpec: true } },
          },
        },
      },
    });
    if (!job) throw new SpeechJobNotFoundException(`SpeechJob ${id} not found`);
    if (job.status === "FAILED")
      throw new SpeechJobResultConflictException(
        "旧的失败语音任务不可被新结果覆盖",
      );

    const item = job.assessmentItem;
    const recording = job.recording;
    if (!job.recordingId || !job.assessmentItemId || !recording || !item) {
      throw new SpeechJobStrategyMismatchException(
        "语音任务缺少有效的录音或测评题目关联",
      );
    }
    if (recording.id !== job.recordingId || item.id !== job.assessmentItemId) {
      throw new SpeechJobStrategyMismatchException("语音任务关联不一致");
    }
    if (job.schoolId && job.schoolId !== item.session.schoolId) {
      throw new SpeechJobStrategyMismatchException("语音任务学校范围不一致");
    }
    if (recording.schoolId !== item.session.schoolId) {
      throw new SpeechJobStrategyMismatchException(
        "录音与测评题目学校范围不一致",
      );
    }
    if (item.recordingId && item.recordingId !== job.recordingId) {
      throw new SpeechJobStrategyMismatchException("录音与测评题目绑定不一致");
    }
    if (
      item.questionVersionId === null ||
      !item.questionVersion ||
      item.questionVersion.status !== "PUBLISHED"
    ) {
      throw new SpeechJobStrategyMismatchException(
        "语音任务没有可用的已发布题库版本",
      );
    }

    const scoringSpec = item.questionVersion.scoringSpec;
    const strategy = strategyOf(scoringSpec);
    const specMaxScore = isRecord(scoringSpec)
      ? scoringSpec.maxScore
      : undefined;
    const policy =
      strategy === OPEN_RESPONSE_STRATEGY
        ? buildOpenResponsePolicyResult({
            providerResult,
            strategy,
            itemMaxScore: item.maxScore,
            specMaxScore,
          })
        : strategy === READ_ALOUD_STRATEGY
          ? buildReadAloudPolicyResult({
              providerResult,
              strategy,
              itemMaxScore: item.maxScore,
              specMaxScore,
            })
          : (() => {
              throw new SpeechJobStrategyMismatchException(
                "当前题型不是受支持的语音评分策略",
              );
            })();
    const expectedTarget = targetTextOf(scoringSpec);
    if (strategy === OPEN_RESPONSE_STRATEGY) {
      if (job.targetText?.trim()) {
        throw new SpeechJobStrategyMismatchException(
          "开放表达语音任务不得携带朗读目标文本",
        );
      }
    } else if (
      !expectedTarget ||
      !job.targetText ||
      job.targetText.trim() !== expectedTarget
    ) {
      throw new SpeechJobStrategyMismatchException(
        "语音评分目标文本不是服务端题目快照",
      );
    }
    if (item.scoredScore !== null) {
      throw new SpeechJobResultConflictException(
        "题目已经存在正式评分，不能写入本地诊断",
      );
    }

    if (TERMINAL_SPEECH_JOB_STATUSES.has(job.status)) {
      if (
        JSON.stringify(job.result) !== JSON.stringify(policy.providerResult)
      ) {
        throw new SpeechJobResultConflictException();
      }
      return toSpeechJobResponse(job);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.speechJob.update({
        where: { id },
        data: {
          status: policy.status,
          provider: policy.providerResult.provider,
          ...("providerModel" in policy.providerResult &&
          policy.providerResult.providerModel
            ? { providerModel: policy.providerResult.providerModel }
            : {}),
          result: policy.providerResult as any,
          confidence: policy.providerResult.confidence,
          ...(policy.providerResult.processingMs !== undefined
            ? { processingMs: policy.providerResult.processingMs }
            : {}),
          errorCode: null,
        },
      });
      await tx.assessmentItem.update({
        where: { id: item.id },
        data: {
          autoResult: policy.diagnostic as any,
          scoredScore: null,
        },
      });
      await tx.recording.update({
        where: { id: recording.id },
        data: { status: "READY" },
      });
      return next;
    });

    return toSpeechJobResponse(updated);
  }

  /** Backward-compatible name for trusted internal callers. */
  async updateSpeechJobResult(
    id: string,
    result: unknown,
    _extra?: {
      confidence?: number;
      processingMs?: number;
      providerModel?: string;
    },
  ) {
    return this.applySpeechProviderResult(id, result);
  }

  /**
   * Update the status of a SpeechJob (e.g. mark as PROCESSING, FAILED, etc.).
   */
  async updateSpeechJobStatus(
    id: string,
    status: SpeechJobStatus,
    errorCode?: string,
  ) {
    const job = await this.prisma.speechJob.update({
      where: { id },
      data: {
        status,
        ...(errorCode ? { errorCode } : {}),
        // Increment retryCount on FAILED if retries are available
        ...(status === "FAILED" ? { retryCount: { increment: 1 } } : {}),
      },
    });

    this.logger.log(`SpeechJob status updated: id=${id} status=${status}`);
    return toSpeechJobResponse(job);
  }

  /**
   * Mark a processing job failed without overwriting a terminal result. The
   * callback intentionally stores only a stable error code; provider/network
   * details stay in worker logs and never become student payload.
   */
  async markSpeechJobFailed(
    id: string,
    errorCode = "PROCESSING_FAILED",
    _errorMessage?: string,
  ) {
    const job = await this.prisma.speechJob.findUnique({
      where: { id },
      include: { recording: { select: { id: true } } },
    });
    if (!job) throw new SpeechJobNotFoundException(`SpeechJob ${id} not found`);
    if (
      job.status === "FAILED" ||
      TERMINAL_SPEECH_JOB_STATUSES.has(job.status)
    ) {
      return toSpeechJobResponse(job);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.speechJob.update({
        where: { id },
        data: {
          status: "FAILED",
          errorCode,
          retryCount: { increment: 1 },
        },
      });
      if (job.recording?.id) {
        await tx.recording.update({
          where: { id: job.recording.id },
          data: { status: "FAILED" },
        });
      }
      return next;
    });
    return toSpeechJobResponse(updated);
  }

  private configuredSpeechProvider(): "disabled" | "local" | "iflytek" | "tencent" {
    const value = (
      this.config.get<string>("SPEECH_PROVIDER", "disabled") ?? "disabled"
    )
      .trim()
      .toLowerCase();
    if (
      value === "disabled" ||
      value === "local" ||
      value === "iflytek" ||
      value === "tencent"
    ) return value;
    throw new SpeechProviderNotConfiguredException(
      `不支持的 SPEECH_PROVIDER=${value || "<empty>"}，仅支持 disabled、local、iflytek 或 tencent`,
    );
  }

  private async resolveQuestionBankTask(
    recordingId: string,
    assessmentItemId: string | undefined,
    schoolId: string,
    suppliedTargetText: string | undefined,
  ): Promise<SpeechTask> {
    if (!assessmentItemId) {
      const target = suppliedTargetText?.trim();
      if (!target)
        throw new SpeechJobStrategyMismatchException("缺少朗读目标文本");
      return { strategy: READ_ALOUD_STRATEGY, targetText: target };
    }

    const item = await this.prisma.assessmentItem.findFirst({
      where: { id: assessmentItemId, session: { schoolId } },
      select: {
        recordingId: true,
        prompt: true,
        questionVersion: { select: { status: true, scoringSpec: true } },
      },
    });
    if (!item)
      throw new SpeechJobNotFoundException("测评题目不存在或不属于当前学校");
    if (item.recordingId && item.recordingId !== recordingId) {
      throw new SpeechJobStrategyMismatchException("录音与测评题目绑定不一致");
    }

    // Legacy assessment items may still supply a server-validated target. A
    // Question Bank item, however, must use its immutable scoring snapshot.
    if (!item.questionVersion) {
      const target = suppliedTargetText?.trim();
      if (!target)
        throw new SpeechJobStrategyMismatchException("缺少朗读目标文本");
      return { strategy: READ_ALOUD_STRATEGY, targetText: target };
    }
    if (item.questionVersion.status !== "PUBLISHED") {
      throw new SpeechJobStrategyMismatchException(
        "语音任务没有可用的已发布题库版本",
      );
    }
    const scoringSpec = item.questionVersion.scoringSpec;
    const strategy = strategyOf(scoringSpec);
    if (strategy === OPEN_RESPONSE_STRATEGY) {
      if (suppliedTargetText?.trim()) {
        throw new SpeechJobStrategyMismatchException(
          "当前题型不是 READ_ALOUD，开放表达语音任务不得携带朗读目标文本",
        );
      }
      return { strategy: OPEN_RESPONSE_STRATEGY };
    }
    if (strategy !== READ_ALOUD_STRATEGY) {
      throw new SpeechJobStrategyMismatchException(
        "当前题型不是受支持的语音评分策略",
      );
    }
    const target =
      targetTextOf(scoringSpec) ?? targetTextFromPrompt(item.prompt);
    if (!target)
      throw new SpeechJobStrategyMismatchException(
        "题库题目缺少服务端朗读目标文本",
      );
    return { strategy: READ_ALOUD_STRATEGY, targetText: target };
  }

  /**
   * Trigger speech processing after a recording is complete.
   *
   * Steps:
   *  1. Create a SpeechJob with status=CREATED
   *  2. Update the Recording status to PROCESSING
   *  3. If SPEECH_PROVIDER is configured (not "disabled") and Redis is available,
   *     dispatch a BullMQ job; otherwise leave status as CREATED
   *
   * Returns the created SpeechJob.
   */
  async triggerSpeechProcessing(
    recordingId: string,
    assessmentItemId: string | undefined,
    targetText: string | undefined,
    schoolId: string,
    options?: {
      scorerVersion?: string;
      provider?: string;
    },
  ) {
    const speechProvider = this.configuredSpeechProvider();
    if (options?.provider) {
      const requestedProvider = options.provider.trim().toLowerCase();
      if (requestedProvider !== speechProvider) {
        throw new SpeechProviderNotConfiguredException(
          `请求的语音 provider=${requestedProvider} 与当前配置不一致`,
        );
      }
    }
    const task = await this.resolveQuestionBankTask(
      recordingId,
      assessmentItemId,
      schoolId,
      targetText,
    );

    // Repeated completion/recovery calls must reuse the active result chain.
    // Failed jobs are intentionally excluded so an explicit retry can create a
    // new auditable attempt without overwriting the prior failure.
    let job = await this.prisma.speechJob.findFirst({
      where: {
        recordingId,
        assessmentItemId: assessmentItemId ?? null,
        schoolId,
        status: { not: "FAILED" },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      job = await this.prisma.speechJob.create({
        data: {
          recordingId,
          ...(assessmentItemId ? { assessmentItemId } : {}),
          schoolId,
          targetText: task.targetText ?? null,
          status: "CREATED",
          provider: speechProvider,
          scorerVersion:
            options?.scorerVersion ??
            (task.strategy === OPEN_RESPONSE_STRATEGY
              ? "mandarin-open-response-v0.1.0"
              : "mandarin-reading-v0.1.0"),
        },
      });

      this.logger.log(
        `SpeechJob created for processing: id=${job.id} recordingId=${recordingId} provider=${speechProvider}`,
      );
    } else {
      const persistedTarget = job.targetText?.trim() || undefined;
      if (persistedTarget !== task.targetText) {
        throw new SpeechJobStrategyMismatchException(
          "已存在的语音任务目标文本与服务端题目快照不一致",
        );
      }
      this.logger.log(
        `SpeechJob reused for idempotent processing: id=${job.id} recordingId=${recordingId} status=${job.status}`,
      );
    }

    const isTerminal = ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"].includes(
      job.status,
    );
    if (isTerminal) return toSpeechJobResponse(job);

    // Dispatch (or safely re-dispatch CREATED recovery) with a deterministic
    // BullMQ id. BullMQ de-duplicates the same persisted SpeechJob.
    if (speechProvider !== "disabled" && this.speechQueue) {
      // Get the recording's objectKey for the worker to download
      const recording = await this.prisma.recording.findUnique({
        where: { id: recordingId },
        select: { objectKey: true },
      });

      await this.speechQueue.add(
        "speech:process",
        {
          speechJobId: job.id,
          recordingId,
          ...(assessmentItemId ? { assessmentItemId } : {}),
          schoolId,
          strategy: task.strategy,
          ...(task.targetText ? { targetText: task.targetText } : {}),
          scorerVersion:
            options?.scorerVersion ??
            (task.strategy === OPEN_RESPONSE_STRATEGY
              ? "mandarin-open-response-v0.1.0"
              : "mandarin-reading-v0.1.0"),
          objectKey: recording?.objectKey ?? "",
        },
        {
          jobId: `speech-${job.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      job = await this.prisma.speechJob.update({
        where: { id: job.id },
        data: { status: "PROCESSING" },
      });

      await this.prisma.recording.update({
        where: { id: recordingId },
        data: { status: "PROCESSING" },
      });

      this.logger.log(`SpeechJob dispatched to BullMQ queue: id=${job.id}`);
    } else if (speechProvider !== "disabled") {
      // Provider is enabled but queue is not available (Redis not connected)
      this.logger.warn(
        `SPEECH_PROVIDER=${speechProvider} but BullMQ queue not available; SpeechJob ${job.id} remains in CREATED status`,
      );
    } else {
      this.logger.log(
        `SPEECH_PROVIDER=disabled; SpeechJob ${job.id} remains in CREATED status`,
      );
    }

    return toSpeechJobResponse(job);
  }
}
