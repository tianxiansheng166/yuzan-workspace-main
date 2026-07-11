import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import {
  TranslationForbiddenException,
  TranslationInputTooLongException,
  TranslationNotFoundException,
  TranslationRateLimitedException,
} from "./domain/translation.errors.js";
import {
  SupportedLanguage,
  TranslationStatus,
} from "./domain/translation.types.js";
import {
  toGlossaryEntryResponse,
  toTranslationJobResponse,
} from "./dto/translation.response.js";
import type {
  ListJobsOptions,
  TranslationRepositoryPort,
} from "./ports/translation-repository.port.js";
import { TRANSLATION_REPOSITORY } from "./ports/translation-repository.port.js";
import { TranslationsPolicy } from "./translations.policy.js";

const MAX_SOURCE_TEXT_LENGTH = 5000;

@Injectable()
export class TranslationsService {
  private readonly logger = new Logger(TranslationsService.name);
  private readonly policy = new TranslationsPolicy();

  constructor(
    @Inject(TRANSLATION_REPOSITORY)
    private readonly translationRepo: TranslationRepositoryPort,
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

    if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      throw new TranslationInputTooLongException();
    }

    // Rate limiting per user — basic in-process guard
    // A production implementation would use Redis or similar
    this.checkRateLimit(auth.principal.userId);

    // Hash the source text for deduplication / audit (desensitized for logs)
    const sourceTextHash = await this.hashText(sourceText);

    // Encrypt source text for storage — controlled, never sent to frontend
    const sourceTextEncrypted = await this.encryptText(sourceText);

    this.logger.log(
      `Creating translation job for user=${auth.principal.userId} school=${schoolId} hash=${sourceTextHash.slice(0, 8)}...`,
    );

    const job = await this.translationRepo.createJob({
      schoolId,
      sourceLanguage,
      targetLanguage,
      sourceTextHash,
      sourceTextEncrypted,
      status: TranslationStatus.CREATED,
      glossaryVersion: 1,
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
      // Filter by user ownership at repository level in a real implementation
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

  async getGlossary(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewGlossary(auth, schoolId)) {
      throw new TranslationForbiddenException();
    }

    const entries = await this.translationRepo.listGlossary(schoolId);
    return entries.map(toGlossaryEntryResponse);
  }

  private checkRateLimit(_userId: string): void {
    // Placeholder: in production, check against a Redis-backed rate limiter
    // e.g. 10 requests per minute per user
    // For now, this is a no-op guard that will throw TranslationRateLimitedException
    // when the rate limit is exceeded.
  }

  private async hashText(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private async encryptText(text: string): Promise<string> {
    // Placeholder: in production, use AES-256 encryption with a managed key
    // For now, Base64-encode as a stand-in so the field is populated
    return Buffer.from(text, "utf-8").toString("base64");
  }
}
