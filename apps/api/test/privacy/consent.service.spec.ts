import { describe, expect, it, beforeEach } from "vitest";
import { CONSENT_REPOSITORY } from "../../src/modules/privacy/ports/consent-repository.port.js";
import { ConsentService } from "../../src/modules/privacy/consent/consent.service.js";
import {
  PrivacyForbiddenException,
  ConsentVersionNotFoundException,
  ConsentVersionConflictException,
} from "../../src/modules/privacy/domain/privacy.errors.js";
import { FakeConsentRepository } from "./fakes/fake-consent.repository.js";
import { consentVersion } from "./fixtures/privacy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";

describe("ConsentService", () => {
  const schoolId = "school-a";
  let repo: FakeConsentRepository;
  let service: ConsentService;

  beforeEach(() => {
    repo = new FakeConsentRepository();
    service = new ConsentService(repo as unknown as {
      [key: symbol]: unknown;
    }[typeof CONSENT_REPOSITORY]);
  });

  describe("list", () => {
    it("returns consent versions with pagination", async () => {
      const auth = platformAdminAuth(schoolId);
      const c1 = consentVersion({ purpose: "DATA_COLLECTION" });
      const c2 = consentVersion({ purpose: "MARKETING" });
      repo.add(c1, c2);

      const result = await service.list(auth, { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("filters by purpose", async () => {
      const auth = platformAdminAuth(schoolId);
      const c1 = consentVersion({ purpose: "DATA_COLLECTION" });
      const c2 = consentVersion({ purpose: "MARKETING" });
      repo.add(c1, c2);

      const result = await service.list(auth, {
        limit: 10,
        purpose: "DATA_COLLECTION",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.purpose).toBe("DATA_COLLECTION");
    });

    it("returns paginated results with cursor", async () => {
      const auth = platformAdminAuth(schoolId);
      const consents = Array.from({ length: 5 }, (_, i) =>
        consentVersion({ purpose: `PURPOSE_${i}`, version: i + 1 }),
      );
      repo.add(...consents);

      const page1 = await service.list(auth, { limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.hasMore).toBe(true);

      const page2 = await service.list(auth, {
        limit: 3,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(false);
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        PrivacyForbiddenException,
      );
    });
  });

  describe("create", () => {
    it("saves a new consent version", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, {
        purpose: "DATA_COLLECTION",
        version: 1,
        contentHash: "abc123",
      });

      expect(result.purpose).toBe("DATA_COLLECTION");
      expect(result.version).toBe(1);
      expect(result.contentHash).toBe("abc123");
      expect(result.contentUrl).toBeNull();
    });

    it("saves a new consent version with optional fields", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, {
        purpose: "DATA_COLLECTION",
        version: 2,
        contentHash: "def456",
        contentUrl: "https://example.com/consent",
      });

      expect(result.contentUrl).toBe("https://example.com/consent");
    });

    it("rejects duplicate purpose+version", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = consentVersion({
        purpose: "DATA_COLLECTION",
        version: 1,
      });
      repo.add(existing);

      await expect(
        service.create(auth, {
          purpose: "DATA_COLLECTION",
          version: 1,
          contentHash: "new-hash",
        }),
      ).rejects.toThrow(ConsentVersionConflictException);
    });

    it("allows same purpose with different version", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = consentVersion({
        purpose: "DATA_COLLECTION",
        version: 1,
      });
      repo.add(existing);

      const result = await service.create(auth, {
        purpose: "DATA_COLLECTION",
        version: 2,
        contentHash: "new-hash",
      });

      expect(result.version).toBe(2);
    });

    it("rejects non-platform-admin", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.create(auth, {
          purpose: "DATA_COLLECTION",
          version: 1,
          contentHash: "abc123",
        }),
      ).rejects.toThrow(PrivacyForbiddenException);
    });
  });

  describe("fail-closed with unavailable repository", () => {
    it("throws when repository operations fail", async () => {
      const brokenRepo = new FakeConsentRepository();
      brokenRepo.list = async () => {
        throw new Error("Connection refused");
      };

      const service = new ConsentService(brokenRepo as unknown as {
        [key: symbol]: unknown;
      }[typeof CONSENT_REPOSITORY]);
      const auth = platformAdminAuth(schoolId);

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        "Connection refused",
      );
    });
  });
});
