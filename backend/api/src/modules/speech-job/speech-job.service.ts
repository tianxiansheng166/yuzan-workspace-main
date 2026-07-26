import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import type { SpeechJobStatus } from "@yuzan/database";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { toSpeechJobResponse } from "./dto/speech-job.response.js";
import { SPEECH_QUEUE } from "./speech-job.tokens.js";
import { SpeechJobNotFoundException } from "./domain/speech-job.errors.js";

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
    @Optional() @Inject(SPEECH_QUEUE)
    private readonly speechQueue: Queue | null,
  ) {}

  /**
   * Create a SpeechJob linked to a recording and an assessment item.
   */
  async createSpeechJob(data: {
    recordingId: string;
    assessmentItemId: string;
    targetText: string;
    schoolId: string;
    scorerVersion?: string;
    provider?: string;
  }) {
    const job = await this.prisma.speechJob.create({
      data: {
        recordingId: data.recordingId,
        assessmentItemId: data.assessmentItemId,
        schoolId: data.schoolId,
        targetText: data.targetText,
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
  async getSpeechJob(id: string) {
    const job = await this.prisma.speechJob.findUnique({ where: { id } });
    if (!job) {
      throw new SpeechJobNotFoundException(`SpeechJob ${id} not found`);
    }
    return toSpeechJobResponse(job);
  }

  /**
   * List all SpeechJobs for a given assessment item.
   */
  async listSpeechJobsByItem(assessmentItemId: string) {
    const jobs = await this.prisma.speechJob.findMany({
      where: { assessmentItemId },
      orderBy: { createdAt: "desc" },
    });
    return jobs.map(toSpeechJobResponse);
  }

  /**
   * Update the result of a SpeechJob (called by the worker on completion).
   */
  async updateSpeechJobResult(
    id: string,
    result: Record<string, unknown>,
    extra?: {
      confidence?: number;
      processingMs?: number;
      providerModel?: string;
    },
  ) {
    const job = await this.prisma.speechJob.update({
      where: { id },
      data: {
        result: result as any,
        ...(extra?.confidence != null ? { confidence: extra.confidence } : {}),
        ...(extra?.processingMs != null
          ? { processingMs: extra.processingMs }
          : {}),
        ...(extra?.providerModel != null
          ? { providerModel: extra.providerModel }
          : {}),
        status: "AUTO_RESULT",
      },
    });

    this.logger.log(`SpeechJob result updated: id=${id} status=AUTO_RESULT`);
    return toSpeechJobResponse(job);
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
        ...(status === "FAILED"
          ? { retryCount: { increment: 1 } }
          : {}),
      },
    });

    this.logger.log(`SpeechJob status updated: id=${id} status=${status}`);
    return toSpeechJobResponse(job);
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
    targetText: string,
    schoolId: string,
    options?: {
      scorerVersion?: string;
      provider?: string;
    },
  ) {
    const speechProvider = this.config.get<string>("SPEECH_PROVIDER", "disabled");

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
          targetText,
          status: "CREATED",
          ...(options?.scorerVersion
            ? { scorerVersion: options.scorerVersion }
            : {}),
          ...(options?.provider ? { provider: options.provider } : {}),
        },
      });

      this.logger.log(
        `SpeechJob created for processing: id=${job.id} recordingId=${recordingId} provider=${speechProvider}`,
      );
    } else {
      this.logger.log(
        `SpeechJob reused for idempotent processing: id=${job.id} recordingId=${recordingId} status=${job.status}`,
      );
    }

    const isTerminal = ["AUTO_RESULT", "NEEDS_REVIEW", "FINALIZED"].includes(job.status);
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
          assessmentItemId,
          schoolId,
          targetText,
          scorerVersion: options?.scorerVersion ?? "mandarin-reading-v0.1.0",
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

      this.logger.log(
        `SpeechJob dispatched to BullMQ queue: id=${job.id}`,
      );
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
