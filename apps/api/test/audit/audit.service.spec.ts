import { beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "../../src/modules/audit/audit/audit.service.js";
import { AUDIT_REPOSITORY } from "../../src/modules/audit/ports/audit-repository.port.js";
import { FakeAuditRepository } from "./fakes/fake-audit.repository.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";
import { AuditForbiddenException } from "../../src/modules/audit/domain/audit.errors.js";
import { auditLogEntry } from "./fixtures/audit-entries.js";

describe("AuditService", () => {
  let service: AuditService;
  let repo: FakeAuditRepository;
  const schoolId = "school-a";

  beforeEach(() => {
    repo = new FakeAuditRepository();
    service = new AuditService(repo as unknown as { [key: symbol]: unknown }[typeof AUDIT_REPOSITORY]);
  });

  describe("searchAuditLogs", () => {
    it("allows platform admin to search and passes params to repo", async () => {
      const auth = platformAdminAuth(schoolId);
      repo.add(
        auditLogEntry({ id: "e1", schoolId: "school-a" }),
        auditLogEntry({ id: "e2", schoolId: "school-b" }),
      );

      const result = await service.searchAuditLogs(auth, {
        limit: 10,
        schoolId: "school-a",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("e1");
    });

    it("returns filtered results by actorUserId", async () => {
      const auth = platformAdminAuth(schoolId);
      repo.add(
        auditLogEntry({ id: "e1", actorUserId: "user-1" }),
        auditLogEntry({ id: "e2", actorUserId: "user-2" }),
      );

      const result = await service.searchAuditLogs(auth, {
        limit: 10,
        actorUserId: "user-1",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("e1");
    });

    it("returns filtered results by resourceType", async () => {
      const auth = platformAdminAuth(schoolId);
      repo.add(
        auditLogEntry({ id: "e1", resourceType: "COURSE_VERSION" }),
        auditLogEntry({ id: "e2", resourceType: "USER" }),
      );

      const result = await service.searchAuditLogs(auth, {
        limit: 10,
        resourceType: "COURSE_VERSION",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("e1");
    });

    it("returns filtered results by date range", async () => {
      const auth = platformAdminAuth(schoolId);
      const from = new Date("2025-01-14T00:00:00Z");
      const to = new Date("2025-01-16T00:00:00Z");
      repo.add(
        auditLogEntry({ id: "e1", createdAt: new Date("2025-01-15T10:00:00Z") }),
        auditLogEntry({ id: "e2", createdAt: new Date("2025-01-20T00:00:00Z") }),
      );

      const result = await service.searchAuditLogs(auth, {
        limit: 10,
        from,
        to,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("e1");
    });

    it("supports cursor-based pagination", async () => {
      const auth = platformAdminAuth(schoolId);
      repo.add(
        auditLogEntry({ id: "e1", createdAt: new Date("2025-01-15T03:00:00Z") }),
        auditLogEntry({ id: "e2", createdAt: new Date("2025-01-15T02:00:00Z") }),
        auditLogEntry({ id: "e3", createdAt: new Date("2025-01-15T01:00:00Z") }),
      );

      const page1 = await service.searchAuditLogs(auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0]!.id).toBe("e1");
      expect(page1.items[1]!.id).toBe("e2");
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe("e2");

      const page2 = await service.searchAuditLogs(auth, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]!.id).toBe("e3");
      expect(page2.hasMore).toBe(false);
      expect(page2.nextCursor).toBeNull();
    });

    it("rejects non-platform-admin with AuditForbiddenException", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(
        service.searchAuditLogs(auth, { limit: 10 }),
      ).rejects.toThrow(AuditForbiddenException);

      const teacherA = teacherAuth(schoolId);
      await expect(
        service.searchAuditLogs(teacherA, { limit: 10 }),
      ).rejects.toThrow(AuditForbiddenException);

      const studentA = studentAuth(schoolId);
      await expect(
        service.searchAuditLogs(studentA, { limit: 10 }),
      ).rejects.toThrow(AuditForbiddenException);
    });
  });

  describe("findById", () => {
    it("allows platform admin to find and returns entry when found", async () => {
      const auth = platformAdminAuth(schoolId);
      repo.add(auditLogEntry({ id: "e1", action: "UPDATE" }));

      const entry = await service.findById(auth, "e1");
      expect(entry.id).toBe("e1");
      expect(entry.action).toBe("UPDATE");
    });

    it("throws AuditForbiddenException when entry not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.findById(auth, "nonexistent"),
      ).rejects.toThrow(AuditForbiddenException);
    });

    it("rejects non-platform-admin with AuditForbiddenException", async () => {
      const auth = schoolAdminAuth(schoolId);
      repo.add(auditLogEntry({ id: "e1" }));

      await expect(
        service.findById(auth, "e1"),
      ).rejects.toThrow(AuditForbiddenException);

      const teacherA = teacherAuth(schoolId);
      await expect(
        service.findById(teacherA, "e1"),
      ).rejects.toThrow(AuditForbiddenException);

      const studentA = studentAuth(schoolId);
      await expect(
        service.findById(studentA, "e1"),
      ).rejects.toThrow(AuditForbiddenException);
    });
  });

  describe("fail-closed with broken repo", () => {
    it("throws when repo throws error", async () => {
      const brokenRepo = {
        search: async () => { throw new Error("repo broken"); },
        findById: async () => { throw new Error("repo broken"); },
      };
      const brokenService = new AuditService(
        brokenRepo as unknown as { [key: symbol]: unknown }[typeof AUDIT_REPOSITORY],
      );
      const auth = platformAdminAuth(schoolId);

      await expect(
        brokenService.searchAuditLogs(auth, { limit: 10 }),
      ).rejects.toThrow("repo broken");
    });
  });
});
