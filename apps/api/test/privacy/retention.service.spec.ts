import { describe, expect, it, beforeEach } from "vitest";
import { RETENTION_REPOSITORY } from "../../src/modules/privacy/ports/retention-repository.port.js";
import { RetentionService } from "../../src/modules/privacy/retention/retention.service.js";
import {
  PrivacyForbiddenException,
  RetentionPolicyNotFoundException,
  RetentionPolicyConflictException,
} from "../../src/modules/privacy/domain/privacy.errors.js";
import { FakeRetentionRepository } from "./fakes/fake-retention.repository.js";
import { retentionPolicy } from "./fixtures/privacy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("RetentionService", () => {
  const schoolId = "school-a";
  let repo: FakeRetentionRepository;
  let service: RetentionService;

  beforeEach(() => {
    repo = new FakeRetentionRepository();
    service = new RetentionService(repo as unknown as {
      [key: symbol]: unknown;
    }[typeof RETENTION_REPOSITORY]);
  });

  describe("list", () => {
    it("returns policies with pagination", async () => {
      const auth = platformAdminAuth(schoolId);
      const p1 = retentionPolicy({ resourceType: "TYPE_A" });
      const p2 = retentionPolicy({ resourceType: "TYPE_B" });
      repo.add(p1, p2);

      const result = await service.list(auth, { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns paginated results with cursor", async () => {
      const auth = platformAdminAuth(schoolId);
      const policies = Array.from({ length: 5 }, (_, i) =>
        retentionPolicy({ resourceType: `TYPE_${i}` }),
      );
      repo.add(...policies);

      const page1 = await service.list(auth, { limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

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
    it("saves a new policy", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, {
        resourceType: "USER_DATA",
        retentionDays: 365,
      });

      expect(result.resourceType).toBe("USER_DATA");
      expect(result.retentionDays).toBe(365);
      expect(result.description).toBeNull();
    });

    it("saves a new policy with optional fields", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, {
        resourceType: "USER_DATA",
        retentionDays: 90,
        description: "短期保留",
        effectiveFrom: "2025-01-01",
      });

      expect(result.description).toBe("短期保留");
    });

    it("rejects duplicate resourceType", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = retentionPolicy({ resourceType: "USER_DATA" });
      repo.add(existing);

      await expect(
        service.create(auth, {
          resourceType: "USER_DATA",
          retentionDays: 180,
        }),
      ).rejects.toThrow(RetentionPolicyConflictException);
    });

    it("rejects non-platform-admin", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.create(auth, {
          resourceType: "USER_DATA",
          retentionDays: 365,
        }),
      ).rejects.toThrow(PrivacyForbiddenException);
    });
  });

  describe("update", () => {
    it("modifies an existing policy", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = retentionPolicy({
        retentionDays: 365,
        description: null,
      });
      repo.add(existing);

      const result = await service.update(auth, existing.id, {
        retentionDays: 180,
        description: "更新后",
        expectedUpdatedAt: existing.updatedAt.toISOString(),
      });

      expect(result.retentionDays).toBe(180);
      expect(result.description).toBe("更新后");
    });

    it("rejects wrong expectedUpdatedAt", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = retentionPolicy({ retentionDays: 365 });
      repo.add(existing);

      const wrongTimestamp = new Date(
        existing.updatedAt.getTime() - 10000,
      ).toISOString();

      await expect(
        service.update(auth, existing.id, {
          retentionDays: 180,
          expectedUpdatedAt: wrongTimestamp,
        }),
      ).rejects.toThrow(RetentionPolicyConflictException);
    });

    it("rejects update of non-existent policy", async () => {
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.update(auth, "non-existent-id", {
          retentionDays: 180,
          expectedUpdatedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(RetentionPolicyNotFoundException);
    });

    it("rejects non-platform-admin", async () => {
      const auth = studentAuth(schoolId);
      const existing = retentionPolicy();
      repo.add(existing);

      await expect(
        service.update(auth, existing.id, {
          retentionDays: 180,
          expectedUpdatedAt: existing.updatedAt.toISOString(),
        }),
      ).rejects.toThrow(PrivacyForbiddenException);
    });
  });

  describe("fail-closed with unavailable repository", () => {
    it("throws when repository operations fail", async () => {
      const brokenRepo: FakeRetentionRepository = new FakeRetentionRepository();
      const originalList = brokenRepo.list.bind(brokenRepo);
      brokenRepo.list = async () => {
        throw new Error("Connection refused");
      };

      const service = new RetentionService(brokenRepo as unknown as {
        [key: symbol]: unknown;
      }[typeof RETENTION_REPOSITORY]);
      const auth = platformAdminAuth(schoolId);

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        "Connection refused",
      );
    });
  });
});
