import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import {
  TranslationConflictException,
  TranslationForbiddenException,
  TranslationInputTooLongException,
  TranslationNotFoundException,
  TranslationSameLanguageException,
} from "./domain/translation.errors.js";
import {
  ReviewStatus,
  SupportedLanguage,
  TranslationStatus,
} from "./domain/translation.types.js";
import type { TranslationCryptoPort } from "./crypto/aes-gcm.crypto.js";
import { TRANSLATION_CRYPTO } from "./crypto/aes-gcm.crypto.js";
import {
  toGlossaryEntryResponse,
  toTranslationJobResponse,
} from "./dto/translation.response.js";
import type {
  ListJobsOptions,
  TranslationRepositoryPort,
} from "./ports/translation-repository.port.js";
import { TRANSLATION_REPOSITORY } from "./ports/translation-repository.port.js";
import type { TranslationRateLimiterPort } from "./rate-limit/translation-rate-limit.js";
import { TRANSLATION_RATE_LIMITER } from "./rate-limit/translation-rate-limit.js";
import type { TranslationProviderPort } from "./provider/translation-provider.adapter.js";
import { TRANSLATION_PROVIDER } from "./provider/translation-provider.adapter.js";
import { TranslationsPolicy } from "./translations.policy.js";

const MAX_SOURCE_TEXT_LENGTH = 5000;

@Injectable()
export class TranslationsService {
  private readonly logger = new Logger(TranslationsService.name);
  private readonly policy = new TranslationsPolicy();

  constructor(
    @Inject(TRANSLATION_REPOSITORY)
    private readonly translationRepo: TranslationRepositoryPort,
    @Inject(TRANSLATION_CRYPTO)
    private readonly crypto: TranslationCryptoPort,
    @Inject(TRANSLATION_RATE_LIMITER)
    private readonly rateLimiter: TranslationRateLimiterPort,
    @Inject(TRANSLATION_PROVIDER)
    private readonly provider: TranslationProviderPort,
  ) {}

  async createTranslation(
    auth: AuthContext,
    schoolId: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage,
    sourceText: string,
  ) {
    if (!this.policy.canCreateTranslation(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    if (sourceLanguage === targetLanguage) {
      throw new TranslationSameLanguageException();
    }

    if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      throw new TranslationInputTooLongException();
    }

    // Redis-backed rate limiting per user
    await this.rateLimiter.checkRateLimit(auth.principal.userId);

    // Hash the source text for deduplication / audit (desensitized for logs)
    const sourceTextHash = await this.hashText(sourceText);

    // AES-GCM encrypt source text for storage — controlled, never sent to frontend
    const sourceTextEncrypted = await this.crypto.encrypt(sourceText);

    this.logger.log(
      `Creating translation job for user=${auth.principal.userId} school=${schoolId} hash=${sourceTextHash.slice(0, 8)}...`,
    );

    const job = await this.translationRepo.createJob({
      schoolId,
      createdByUserId: auth.principal.userId,
      sourceLanguage,
      targetLanguage,
      sourceTextHash,
      sourceTextEncrypted,
      status: TranslationStatus.CREATED,
      machineResult: null,
      revisedResult: null,
      reviewStatus: null,
      revision: 0,
      reviewedByUserId: null,
      reviewedAt: null,
      glossaryVersion: 1,
      provider: null,
      providerRequestId: null,
      providerModel: null,
      providerLatencyMs: null,
      errorCode: null,
    });

    // Fire-and-forget: attempt synchronous translation via provider
    // In production, this would be dispatched to a BullMQ worker queue.
    this.processTranslation(job.id, schoolId, sourceLanguage, targetLanguage, sourceTextEncrypted).catch(() => {
      // Errors are handled inside processTranslation; this catch prevents unhandled rejection
    });

    return toTranslationJobResponse(job);
  }

  async getJobStatus(auth: AuthContext, schoolId: string, jobId: string) {
    const job = await this.translationRepo.findJobById(schoolId, jobId);
    if (!job) {
      throw new TranslationNotFoundException();
    }

    if (!this.policy.canViewJob(auth, schoolId, job)) {
      throw new TranslationForbiddenException();
    }

    return toTranslationJobResponse(job);
  }

  async listMyJobs(
    auth: AuthContext,
    schoolId: string,
    options: ListJobsOptions,
  ) {
    if (!this.policy.canViewOwnJobs(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const result = await this.translationRepo.listJobsBySchool(schoolId, {
      ...options,
      userId: auth.principal.userId,
    });

    return {
      items: result.items.map(toTranslationJobResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async listJobs(
    auth: AuthContext,
    schoolId: string,
    options: ListJobsOptions,
  ) {
    if (!this.policy.canViewAllJobs(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const result = await this.translationRepo.listJobsBySchool(schoolId, options);

    return {
      items: result.items.map(toTranslationJobResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async reviseJob(
    auth: AuthContext,
    schoolId: string,
    jobId: string,
    revisedResult: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canReviseJob(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const job = await this.translationRepo.findJobById(schoolId, jobId);
    if (!job) {
      throw new TranslationNotFoundException();
    }

    const updated = await this.translationRepo.updateJobRevision(
      schoolId,
      jobId,
      {
        revisedResult,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
        reviewedByUserId: auth.principal.userId,
        reviewedAt: new Date(),
        revision: expectedRevision,
      },
    );

    if (!updated) {
      throw new TranslationConflictException();
    }

    return toTranslationJobResponse(updated);
  }

  async approveJob(
    auth: AuthContext,
    schoolId: string,
    jobId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canApproveJob(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const job = await this.translationRepo.findJobById(schoolId, jobId);
    if (!job) {
      throw new TranslationNotFoundException();
    }

    const updated = await this.translationRepo.updateJobRevision(
      schoolId,
      jobId,
      {
        revisedResult: job.revisedResult ?? job.machineResult ?? "",
        reviewStatus: ReviewStatus.APPROVED,
        reviewedByUserId: auth.principal.userId,
        reviewedAt: new Date(),
        revision: expectedRevision,
      },
    );

    if (!updated) {
      throw new TranslationConflictException();
    }

    return toTranslationJobResponse(updated);
  }

  async rejectJob(
    auth: AuthContext,
    schoolId: string,
    jobId: string,
    expectedRevision: number,
  ) {
    if (!this.policy.canApproveJob(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const job = await this.translationRepo.findJobById(schoolId, jobId);
    if (!job) {
      throw new TranslationNotFoundException();
    }

    const updated = await this.translationRepo.updateJobRevision(
      schoolId,
      jobId,
      {
        revisedResult: job.revisedResult ?? "",
        reviewStatus: ReviewStatus.REJECTED,
        reviewedByUserId: auth.principal.userId,
        reviewedAt: new Date(),
        revision: expectedRevision,
      },
    );

    if (!updated) {
      throw new TranslationConflictException();
    }

    return toTranslationJobResponse(updated);
  }

  async getGlossary(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewGlossary(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const entries = await this.translationRepo.listGlossary(schoolId);
    return entries.map(toGlossaryEntryResponse);
  }

  /**
   * Internal method called by worker via InternalTranslationsController.
   * Updates job result without auth context — protected by X-Internal-Key.
   */
  async updateJobResultFromWorker(
    jobId: string,
    dto: {
      status: TranslationStatus;
      machineResult?: string;
      provider?: string;
      providerRequestId?: string;
      providerModel?: string;
      providerLatencyMs?: number;
      errorCode?: string;
    },
  ) {
    const job = await this.translationRepo.findJobByIdOnly(jobId);
    if (!job) {
      throw new TranslationNotFoundException();
    }

    const updated = await this.translationRepo.updateJobResult(
      job.schoolId,
      jobId,
      {
        status: dto.status,
        ...(dto.machineResult != null ? { machineResult: dto.machineResult } : {}),
        ...(dto.provider != null ? { provider: dto.provider } : {}),
        ...(dto.providerRequestId != null ? { providerRequestId: dto.providerRequestId } : {}),
        ...(dto.providerModel != null ? { providerModel: dto.providerModel } : {}),
        ...(dto.providerLatencyMs != null ? { providerLatencyMs: dto.providerLatencyMs } : {}),
        ...(dto.errorCode != null ? { errorCode: dto.errorCode } : {}),
      },
    );

    if (!updated) {
      throw new TranslationNotFoundException();
    }

    return toTranslationJobResponse(updated);
  }

  /**
   * Process a translation job: decrypt source text, call provider, update result.
   * Designed to be called from a worker queue in production; currently fire-and-forget.
   */
  private async processTranslation(
    jobId: string,
    schoolId: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: SupportedLanguage,
    sourceTextEncrypted: string,
  ): Promise<void> {
    try {
      // Mark as PROCESSING
      await this.translationRepo.updateJobResult(schoolId, jobId, {
        status: TranslationStatus.PROCESSING,
      });

      // Decrypt source text for provider call — never logged or returned
      const sourceText = await this.crypto.decrypt(sourceTextEncrypted);

      const result = await this.provider.translate(
        sourceLanguage,
        targetLanguage,
        sourceText,
      );

      await this.translationRepo.updateJobResult(schoolId, jobId, {
        status: TranslationStatus.COMPLETED,
        machineResult: result.resultText,
        provider: "configurable",
        providerRequestId: result.requestId,
        providerModel: result.model,
        providerLatencyMs: result.latencyMs,
      });
    } catch (err) {
      const isUnavailable =
        err instanceof Error &&
        err.constructor.name === "TranslationUnavailableException";

      await this.translationRepo.updateJobResult(schoolId, jobId, {
        status: isUnavailable
          ? TranslationStatus.PROVIDER_UNAVAILABLE
          : TranslationStatus.FAILED,
        errorCode: isUnavailable ? "PROVIDER_UNAVAILABLE" : "INTERNAL_ERROR",
      }).catch(() => {
        // Prevent double-failure from masking the original error
      });

      this.logger.warn(
        `Translation job ${jobId} failed: ${(err as Error).message}`,
      );
    }
  }

  private async hashText(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
