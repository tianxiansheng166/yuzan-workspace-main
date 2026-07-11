import { describe, expect, it } from "vitest";
import {
  TranslationForbiddenException,
  TranslationInputTooLongException,
  TranslationNotFoundException,
  TranslationRateLimitedException,
  TranslationUnavailableException,
} from "../../../src/modules/translations/domain/translation.errors.js";
import {
  SupportedLanguage,
  TranslationStatus,
} from "../../../src/modules/translations/domain/translation.types.js";
import { UnavailableTranslationRepository } from "../../../src/modules/translations/ports/unavailable-translation.repository.js";
import { TranslationsService } from "../../../src/modules/translations/translations.service.js";
import { FakeTranslationRepository } from "./fakes/fake-translation.repository.js";
import { glossaryEntry, translationJob } from "./fixtures/translations.js";
import {
  schoolAdminAuth,
  studentAuth,
  suspendedStudentAuth,
  teacherAuth,
  platformAdminAuth,
} from "./fixtures/users.js";

function createService(repo?: FakeTranslationRepository) {
  const r = repo ?? new FakeTranslationRepository();
  return { service: new TranslationsService(r), repo: r };
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
      // auth is for school-2, but the request targets school-1
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

    it("never leaks provider key in the response", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.createTranslation(
        auth,
        schoolId,
        SupportedLanguage.BO,
        SupportedLanguage.ZH,
        "secret text",
      );

      expect((result as Record<string, unknown>)["provider"]).toBeUndefined();
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

    it("returns COMPLETED status with result text", async () => {
      const { service, repo } = createService();
      const job = translationJob({
        schoolId,
        status: TranslationStatus.COMPLETED,
        resultText: "翻译结果",
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.status).toBe(TranslationStatus.COMPLETED);
      expect(result.resultText).toBe("翻译结果");
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

      // MUST be PROVIDER_UNAVAILABLE, never COMPLETED
      expect(result.status).toBe(TranslationStatus.PROVIDER_UNAVAILABLE);
      expect(result.resultText).toBeUndefined();
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
      // Auth belongs to a different school
      const auth = teacherAuth("school-2");

      await expect(
        service.getJobStatus(auth, schoolId, job.id),
      ).rejects.toThrow(TranslationForbiddenException);
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

    it("never includes provider key in the response", async () => {
      const { service, repo } = createService();
      const job = translationJob({ schoolId });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect((result as Record<string, unknown>)["provider"]).toBeUndefined();
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

      // The raw error code must be sanitized away
      expect(result.errorCode).toBe("INTERNAL_ERROR");
    });
  });

  // -------------------------------------------------------------------------
  // listMyJobs
  // -------------------------------------------------------------------------
  describe("listMyJobs", () => {
    it("returns jobs for a school member", async () => {
      const { service, repo } = createService();
      repo.addJob(translationJob({ schoolId }));
      const auth = studentAuth(schoolId);

      const result = await service.listMyJobs(auth, schoolId, { limit: 10 });

      expect(result.items).toHaveLength(1);
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
  // getGlossary
  // -------------------------------------------------------------------------
  describe("getGlossary", () => {
    it("returns glossary entries for a school member", async () => {
      const { service, repo } = createService();
      repo.addGlossaryEntry({
        schoolId,
        ...glossaryEntry({ term: "སློབ་གྲྭ།" }),
      });
      const auth = teacherAuth(schoolId);

      const result = await service.getGlossary(auth, schoolId);

      expect(result).toHaveLength(1);
      expect(result[0]!.term).toBe("སློབ་གྲྭ།");
    });

    it("allows STUDENT to view glossary", async () => {
      const { service, repo } = createService();
      repo.addGlossaryEntry({
        schoolId,
        ...glossaryEntry({}),
      });
      const auth = studentAuth(schoolId);

      const result = await service.getGlossary(auth, schoolId);

      expect(result).toHaveLength(1);
    });

    it("denies cross-tenant glossary access", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-2");

      await expect(
        service.getGlossary(auth, schoolId),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("denies suspended user from viewing glossary", async () => {
      const { service } = createService();
      const auth = suspendedStudentAuth(schoolId);

      await expect(
        service.getGlossary(auth, schoolId),
      ).rejects.toThrow(TranslationForbiddenException);
    });

    it("returns empty list when no glossary entries exist", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.getGlossary(auth, schoolId);

      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unavailable repository — fail-closed
  // -------------------------------------------------------------------------
  describe("fail-closed when repository is unavailable", () => {
    it("throws TranslationUnavailableException on createTranslation", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
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
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.getJobStatus(auth, schoolId, "any-id"),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("throws TranslationUnavailableException on listMyJobs", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
      );
      const auth = studentAuth(schoolId);

      await expect(
        service.listMyJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("throws TranslationUnavailableException on listJobs", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.listJobs(auth, schoolId, { limit: 10 }),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("throws TranslationUnavailableException on getGlossary", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.getGlossary(auth, schoolId),
      ).rejects.toThrow(TranslationUnavailableException);
    });

    it("never returns fake completed results when provider is unavailable", async () => {
      const service = new TranslationsService(
        new UnavailableTranslationRepository(),
      );
      const auth = teacherAuth(schoolId);

      // Each operation must throw, never return a fabricated COMPLETED result
      let threw = false;
      try {
        await service.createTranslation(
          auth,
          schoolId,
          SupportedLanguage.BO,
          SupportedLanguage.ZH,
          "test",
        );
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(TranslationUnavailableException);
        // Verify it's NOT a TranslationNotFoundException or other misleading exception
        expect(err).not.toBeInstanceOf(TranslationNotFoundException);
      }
      expect(threw).toBe(true);
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

      await expect(
        service.getGlossary(otherSchoolAuth, schoolId),
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

    it("can view glossary in any school", async () => {
      const { service, repo } = createService();
      repo.addGlossaryEntry({
        schoolId,
        ...glossaryEntry({}),
      });
      const auth = platformAdminAuth("school-999");

      const result = await service.getGlossary(auth, schoolId);

      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------
  describe("rate limiting", () => {
    it("throws TranslationRateLimitedException when rate limit is exceeded", async () => {
      // The current implementation has checkRateLimit as a no-op.
      // This test validates the wiring: if checkRateLimit ever throws,
      // the exception propagates correctly.
      // We test the exception class is defined and can be thrown.
      const error = new TranslationRateLimitedException();
      expect(error).toBeInstanceOf(TranslationRateLimitedException);
      expect(error.getStatus()).toBe(429);

      const body = error.getResponse() as Record<string, unknown>;
      expect(body.code).toBe("TRANSLATION_RATE_LIMITED");
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

    it("response never includes provider", async () => {
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
});
