import { describe, expect, it, vi } from "vitest";
import {
  TranslationConflictException,
  TranslationForbiddenException,
  TranslationInputTooLongException,
  TranslationNotFoundException,
  TranslationRateLimitedException,
  TranslationSameLanguageException,
  TranslationUnavailableException,
} from "../../../src/modules/translations/domain/translation.errors.js";
import type { TranslationCryptoPort } from "../../../src/modules/translations/crypto/aes-gcm.crypto.js";
import {
  ReviewStatus,
  SupportedLanguage,
  TranslationStatus,
} from "../../../src/modules/translations/domain/translation.types.js";
import type { TranslationProviderPort } from "../../../src/modules/translations/provider/translation-provider.adapter.js";
import type { TranslationRateLimiterPort } from "../../../src/modules/translations/rate-limit/translation-rate-limit.js";
import { UnavailableTranslationRepository } from "../../../src/modules/translations/ports/unavailable-translation.repository.js";
import { TranslationsService } from "../../../src/modules/translations/translations.service.js";
import { FakeTranslationRepository } from "./fakes/fake-translation.repository.js";
import { completedJob, translationJob } from "./fixtures/translations.js";
import {
  schoolAdminAuth,
  studentAuth,
  suspendedStudentAuth,
  teacherAuth,
  platformAdminAuth,
} from "./fixtures/users.js";

// ---------------------------------------------------------------------------
// Fake dependencies for service constructor
// ---------------------------------------------------------------------------

class FakeCrypto implements TranslationCryptoPort {
  async encrypt(plaintext: string): Promise<string> {
    return `enc:${plaintext}`;
  }
  async decrypt(ciphertext: string): Promise<string> {
    return ciphertext.replace(/^enc:/, "");
  }
}

class FakeRateLimiter implements TranslationRateLimiterPort {
  async checkRateLimit(_userId: string): Promise<void> {
    // No-op by default; tests can override via subclass or flag
  }
}

class ThrowingRateLimiter implements TranslationRateLimiterPort {
  async checkRateLimit(_userId: string): Promise<void> {
    throw new TranslationRateLimitedException();
  }
}

class FakeProvider implements TranslationProviderPort {
  async translate(
    _sourceLang: SupportedLanguage,
    _targetLang: SupportedLanguage,
    _text: string,
  ) {
    return {
      resultText: "mock-translation",
      requestId: "req-1",
      model: "fake-model",
      latencyMs: 100,
    };
  }
}

class UnavailableProvider implements TranslationProviderPort {
  async translate() {
    throw new TranslationUnavailableException("provider not configured");
  }
}

function createService(options?: {
  repo?: FakeTranslationRepository;
  rateLimiter?: TranslationRateLimiterPort;
  provider?: TranslationProviderPort;
}) {
  const repo = options?.repo ?? new FakeTranslationRepository();
  return {
    service: new TranslationsService(
      repo,
      new FakeCrypto(),
      options?.rateLimiter ?? new FakeRateLimiter(),
      options?.provider ?? new FakeProvider(),
    ),
    repo,
  };
}

const schoolId = "school-1";

// ---------------------------------------------------------------------------
// createTranslation
// ---------------------------------------------------------------------------
describe("TranslationsService", () => {
  describe("createTranslation", () => {
    it("allows TEACHER to create a translation", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        "བཀྲ་ཤིས་བདེ་ལེགས།",
      );

      expect(result.status).toBe(TranslationStatus.CREATED);
      expect(result.sourceLanguage).toBe(SupportedLanguage.BO);
      expect(result.targetLanguage).toBe(SupportedLanguage.ZH);
    });

    it("allows STUDENT to create a translation (student is a school member)", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        "མཚམས་མཆོད།",
      );

      expect(result.status).toBe(TranslationStatus.CREATED);
    });

    it("denies cross-tenant create", async () => {
      const { service } = createService();
      const auth = studentAuth("school-2");

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        ),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("denies suspended user from creating translation", async () => {
      const { service } = createService();
      const auth = suspendedStudentAuth(schoolId);

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        ),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("rejects source text exceeding 5000 characters", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);
      const longText = "a".repeat(5001);

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          longText,
        ),
      ).rejects.toThrow(TranslationInputTooLongException);
    });

    it("accepts source text at exactly 5000 characters", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);
      const maxLengthText = "a".repeat(5000);

      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        maxLengthText,
      );

      expect(result.status).toBe(TranslationStatus.CREATED);
    });

    it("rejects same-language translation", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.BO,
          "test",
        ),
      ).rejects.toThrow(TranslationSameLanguageException);
    });

    it("never leaks sourceTextEncrypted in the response", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        "secret text",
      );

      expect(
        (result as Record<string, unknown>)["sourceTextEncrypted"],
      ).toBeUndefined();
    });

    it("rate limits when exceeded", async () => {
      const { service } = createService({
        rateLimiter: new ThrowingRateLimiter(),
      });
      const auth = teacherAuth(schoolId);

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        ),
      ).rejects.toThrow(TranslationRateLimitedException);
    });
  });

  // -------------------------------------------------------------------------
  // getJobStatus
  // -------------------------------------------------------------------------
  describe("getJobStatus", () => {
    it("returns the real status of a job", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        status: TranslationStatus.PROCESSING,
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.status).toBe(TranslationStatus.PROCESSING);
    });

    it("returns COMPLETED status with machineResult", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.status).toBe(TranslationStatus.COMPLETED);
      expect(result.machineResult).toBe("翻译结果文本");
    });

    it("returns PROVIDER_UNAVAILABLE status without fabricating completion", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        status: TranslationStatus.PROVIDER_UNAVAILABLE,
        errorCode: "PROVIDER_UNAVAILABLE",
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.status).toBe(TranslationStatus.PROVIDER_UNAVAILABLE);
      expect(result.machineResult).toBeNull();
    });

    it("throws TranslationNotFoundException for missing job", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.getJobStatus(auth, schoolId, "nonexistent-id"),
      ).rejects.toThrow(TranslationNotFoundException);
    });

    it("denies cross-tenant access to a job", async () => {
      const { service, repo } = createService();
      const job = translationJob({ schoolId });
      repo.addJob(job);
      const auth = teacherAuth("school-2");

      await expect(
        service.getJobStatus(auth, schoolId, job.id),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("denies student access to another student's job", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        createdByUserId: "other-student",
      });
      repo.addJob(job);
      // studentAuth defaults to userId "student-1"
      const auth = studentAuth(schoolId);

      await expect(
        service.getJobStatus(auth, schoolId, job.id),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("allows student to view their own job", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        createdByUserId: "student-1",
      });
      repo.addJob(job);
      const auth = studentAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.id).toBe(job.id);
    });

    it("never includes sourceTextEncrypted in the response", async () => {
      const { service, repo } = createService();
      const job = translationJob({ schoolId });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(
        (result as Record<string, unknown>)["sourceTextEncrypted"],
      ).toBeUndefined();
    });

    it("sanitizes unknown error codes to INTERNAL_ERROR", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        status: TranslationStatus.FAILED,
        errorCode: "AWS_SECRET_INTERNAL_STACK_TRACE",
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.errorCode).toBe("INTERNAL_ERROR");
    });
  });

  // -------------------------------------------------------------------------
  // listMyJobs
  // -------------------------------------------------------------------------
  describe("listMyJobs", () => {
    it("returns jobs filtered by userId", async () => {
      const { service, repo } = createService();
      const job1 = translationJob({ schoolId, createdByUserId: "student-1" });
      const job2 = translationJob({ schoolId, createdByUserId: "other-user" });
      repo.addJob(job1);
      repo.addJob(job2);
      const auth = studentAuth(schoolId);

      const result = await service.listMyJobs(auth, schoolId, { limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(job1.id);
    });

    it("denies cross-tenant listing", async () => {
      const { service } = createService();
      const auth = studentAuth("school-2");

      await expect(
        service.listMyJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("denies suspended user from listing own jobs", async () => {
      const { service } = createService();
      const auth = suspendedStudentAuth(schoolId);

      await expect(
        service.listMyJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // listJobs (admin-level)
  // -------------------------------------------------------------------------
  describe("listJobs", () => {
    it("allows TEACHER to list all jobs", async () => {
      const { service, repo } = createService();
      repo.addJob(translationJob({ schoolId }));
      const auth = teacherAuth(schoolId);

      const result = await service.listJobs(auth, schoolId, { limit: 10 });

      expect(result.items).toHaveLength(1);
    });

    it("allows SCHOOL_ADMIN to list all jobs", async () => {
      const { service, repo } = createService();
      repo.addJob(translationJob({ schoolId }));
      const auth = schoolAdminAuth(schoolId);

      const result = await service.listJobs(auth, schoolId, { limit: 10 });

      expect(result.items).toHaveLength(1);
    });

    it("denies STUDENT from listing all jobs", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.listJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("denies cross-tenant listing", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-2");

      await expect(
        service.listJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // reviseJob
  // -------------------------------------------------------------------------
  describe("reviseJob", () => {
    it("allows TEACHER to revise a job with correct revision", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId, revision: 0 });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.reviseJob(
        auth,
        schoolId,
        job.id,
        "修订后的翻译",
        0,
      );

      expect(result.revisedResult).toBe("修订后的翻译");
      expect(result.revision).toBe(1);
      expect(result.reviewStatus).toBe(ReviewStatus.NEEDS_REVIEW);
    });

    it("throws ConflictException on revision mismatch (409)", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId, revision: 2 });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      await expect(
        service.reviseJob(auth, schoolId, job.id, "修改", 0),
      ).rejects.toThrow(TranslationConflictException);
    });

    it("denies STUDENT from revising", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId, revision: 0 });
      repo.addJob(job);
      const auth = studentAuth(schoolId);

      await expect(
        service.reviseJob(auth, schoolId, job.id, "修改", 0),
      ).rejects.toThrow(TranslationForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // approveJob
  // -------------------------------------------------------------------------
  describe("approveJob", () => {
    it("allows TEACHER to approve a job", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId, revision: 1, revisedResult: "修订结果" });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.approveJob(auth, schoolId, job.id, 1);

      expect(result.reviewStatus).toBe(ReviewStatus.APPROVED);
      expect(result.revision).toBe(2);
    });

    it("throws ConflictException on revision mismatch", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId, revision: 5 });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      await expect(
        service.approveJob(auth, schoolId, job.id, 0),
      ).rejects.toThrow(TranslationConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // rejectJob
  // -------------------------------------------------------------------------
  describe("rejectJob", () => {
    it("allows TEACHER to reject a job", async () => {
      const { service, repo } = createService();
      const job = completedJob({ schoolId, revision: 0 });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.rejectJob(auth, schoolId, job.id, 0);

      expect(result.reviewStatus).toBe(ReviewStatus.REJECTED);
    });
  });

  // -------------------------------------------------------------------------
  // Unavailable repository — fail-closed
  // -------------------------------------------------------------------------
  describe("fail-closed when repository is unavailable", () => {
    it("throws TranslationUnavailableException on createTranslation", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
        new FakeCrypto(),
        new FakeRateLimiter(),
        new FakeProvider(),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        ),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("throws TranslationUnavailableException on getJobStatus", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
        new FakeCrypto(),
        new FakeRateLimiter(),
        new FakeProvider(),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.getJobStatus(auth, schoolId, "any-id"),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("throws TranslationUnavailableException on listMyJobs", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
        new FakeCrypto(),
        new FakeRateLimiter(),
        new FakeProvider(),
      );
      const auth = studentAuth(schoolId);

      await expect(
        service.listMyJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("throws TranslationUnavailableException on listJobs", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
        new FakeCrypto(),
        new FakeRateLimiter(),
        new FakeProvider(),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.listJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("never returns fake completed results when provider is unavailable", async () => {
      const { service, repo } = createService({
        provider: new UnavailableProvider(),
      });
      const auth = teacherAuth(schoolId);

      // Create will succeed but the async processTranslation will mark FAILED
      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        "test",
      );

      // Job should be CREATED initially (fire-and-forget processing)
      expect(result.status).toBe(TranslationStatus.CREATED);
      // No fake result
      expect(result.machineResult).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Cross-tenant access
  // -------------------------------------------------------------------------
  describe("cross-tenant access", () => {
    it("denies access to a different school for every operation", async () => {
      const { service, repo } = createService();
      const job = translationJob({ schoolId });
      repo.addJob(job);
      const otherSchoolAuth = teacherAuth("school-2");

      await expect(
        service.createTranslation(
          otherSchoolAuth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        ),
      ).rejects.toThrow(TranslationForbiddenException);

      await expect(
        service.getJobStatus(otherSchoolAuth, schoolId, job.id),
      ).rejects.toThrow(TranslationForbiddenException);

      await expect(
        service.listMyJobs(otherSchoolAuth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationForbiddenException);

      await expect(
        service.listJobs(otherSchoolAuth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // PLATFORM_ADMIN can access any school
  // -------------------------------------------------------------------------
  describe("PLATFORM_ADMIN access", () => {
    it("can create translation in any school", async () => {
      const { service } = createService();
      const auth = platformAdminAuth("school-999");

      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        "admin test",
      );

      expect(result.status).toBe(TranslationStatus.CREATED);
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------
  describe("rate limiting", () => {
    it("throws TranslationRateLimitedException when rate limit is exceeded", async () => {
      const error = new TranslationRateLimitedException();
      expect(error).toBeInstanceOf(TranslationRateLimitedException);
      expect(error.getStatus()).toBe(429);

      const body = error.getResponse() as Record<string, unknown>;
      expect(body.code).toBe("TRANSLATION_RATE_LIMITED");
    });

    it("propagates rate limit exception from limiter", async () => {
      const { service } = createService({
        rateLimiter: new ThrowingRateLimiter(),
      });
      const auth = teacherAuth(schoolId);

      await expect(
        service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        ),
      ).rejects.toThrow(TranslationRateLimitedException);
    });
  });

  // -------------------------------------------------------------------------
  // Error sanitization
  // -------------------------------------------------------------------------
  describe("error sanitization", () => {
    it("response never includes sourceTextEncrypted", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        sourceTextEncrypted: "HIGHLY_SENSITIVE_ENCRYPTED_DATA",
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);
      const keys = Object.keys(result);

      expect(keys).not.toContain("sourceTextEncrypted");
    });

    it("response never includes provider key in the response", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        provider: "aws-translate",
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);
      const keys = Object.keys(result);

      expect(keys).not.toContain("provider");
    });

    it("sanitizes unknown error codes to INTERNAL_ERROR", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        status: TranslationStatus.FAILED,
        errorCode: "PROVIDER_INTERNAL_AWS_ERROR_12345",
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.errorCode).toBe("INTERNAL_ERROR");
    });

    it("preserves known safe error codes", async () => {
      const safeCodes = [
        "PROVIDER_UNAVAILABLE",
        "QUOTA_EXCEEDED",
        "INVALID_INPUT",
        "INTERNAL_ERROR",
      ] as const;

      for (const code of safeCodes) {
        const { service, repo } = createService();
        const job = translationJob({
          schoolId,
          status: TranslationStatus.FAILED,
          errorCode: code,
        });
        repo.addJob(job);
        const auth = teacherAuth(schoolId);

        const result = await service.getJobStatus(auth, schoolId, job.id);

        expect(result.errorCode).toBe(code);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Provider retry protection
  // -------------------------------------------------------------------------
  describe("provider retry protection", () => {
    it("does not overwrite APPROVED job with provider retry", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        status: TranslationStatus.COMPLETED,
        machineResult: "original",
        reviewStatus: ReviewStatus.APPROVED,
        revision: 1,
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      // Try to update via the internal method (simulating provider retry)
      const result = await service.updateJobResultFromWorker(job.id, {
        status: TranslationStatus.COMPLETED,
        machineResult: "overwritten-by-retry",
      });

      // The APPROVED job should be returned unchanged
      expect(result.machineResult).toBe("original");
      expect(result.reviewStatus).toBe(ReviewStatus.APPROVED);
    });
  });
});
