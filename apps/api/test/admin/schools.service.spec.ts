import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { SchoolsService } from "../../src/modules/admin/schools/schools.service.js";
import { AdminModule } from "../../src/modules/admin/admin.module.js";
import { ADMIN_SCHOOL_REPOSITORY } from "../../src/modules/admin/ports/admin-school-repository.port.js";
import { ADMIN_METRICS_PORT } from "../../src/modules/admin/ports/admin-metrics.port.js";
import { UnavailableAdminSchoolRepository } from "../../src/modules/admin/ports/unavailable-admin-school.repository.js";
import { FakeAdminSchoolRepository } from "./fakes/fake-admin-school.repository.js";
import { FakeAdminMetricsPort } from "./fakes/fake-admin-metrics.port.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";
import {
  AdminForbiddenException,
  AdminNotFoundException,
  AdminConflictException,
} from "../../src/modules/admin/domain/admin.errors.js";
import { adminSchool } from "./fixtures/schools.js";

describe("SchoolsService", () => {
  let service: SchoolsService;
  let schoolRepo: FakeAdminSchoolRepository;
  let metricsPort: FakeAdminMetricsPort;
  const schoolId = "school-a";

  beforeEach(async () => {
    schoolRepo = new FakeAdminSchoolRepository();
    metricsPort = new FakeAdminMetricsPort();

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(ADMIN_SCHOOL_REPOSITORY)
      .useValue(schoolRepo)
      .overrideProvider(ADMIN_METRICS_PORT)
      .useValue(metricsPort)
      .compile();

    service = moduleRef.get(SchoolsService);
  });

  describe("list", () => {
    it("returns filtered schools for platform admin", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(
        adminSchool({ id: "s1", name: "学校A", isActive: true }),
        adminSchool({ id: "s2", name: "学校B", isActive: false }),
      );

      const result = await service.list(auth, { limit: 10, isActive: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("学校A");
    });

    it("returns schools matching search query", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(
        adminSchool({ id: "s1", name: "拉萨市第一小学" }),
        adminSchool({ id: "s2", name: "北京市第二小学" }),
      );

      const result = await service.list(auth, { limit: 10, search: "拉萨" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe("拉萨市第一小学");
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(
        service.list(auth, { limit: 10 }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("findById", () => {
    it("returns school when found", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1", name: "学校A" }));

      const result = await service.findById(auth, "s1");
      expect(result.id).toBe("s1");
      expect(result.name).toBe("学校A");
    });

    it("throws AdminNotFoundException when school not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(service.findById(auth, "nonexistent")).rejects.toThrow(
        AdminNotFoundException,
      );
    });
  });

  describe("create", () => {
    it("creates a new school", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, {
        code: "SCH-NEW",
        name: "新学校",
      });

      expect(result.code).toBe("SCH-NEW");
      expect(result.name).toBe("新学校");
      expect(result.isActive).toBe(true);
    });

    it("rejects non-platform-admin", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.create(auth, { code: "X", name: "X" }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("update", () => {
    it("updates an existing school", async () => {
      const auth = platformAdminAuth(schoolId);
      const school = adminSchool({ id: "s1", name: "学校A" });
      schoolRepo.add(school);

      const result = await service.update(auth, "s1", {
        expectedUpdatedAt: school.updatedAt.toISOString(),
        name: "更新后学校",
      });

      expect(result.name).toBe("更新后学校");
    });

    it("throws AdminConflictException on stale update", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1" }));

      await expect(
        service.update(auth, "s1", {
          expectedUpdatedAt: new Date("2020-01-01").toISOString(),
          name: "过期更新",
        }),
      ).rejects.toThrow(AdminConflictException);
    });

    it("throws AdminNotFoundException when school not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.update(auth, "nonexistent", {
          expectedUpdatedAt: new Date().toISOString(),
          name: "不存在",
        }),
      ).rejects.toThrow(AdminNotFoundException);
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1" }));

      await expect(
        service.update(auth, "s1", {
          expectedUpdatedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("activate", () => {
    it("activates an inactive school", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1", isActive: false }));

      const result = await service.activate(auth, "s1");
      expect(result.isActive).toBe(true);
    });

    it("throws AdminConflictException when already active", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1", isActive: true }));

      await expect(service.activate(auth, "s1")).rejects.toThrow(
        AdminConflictException,
      );
    });
  });

  describe("deactivate", () => {
    it("deactivates an active school", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1", isActive: true }));

      const result = await service.deactivate(auth, "s1");
      expect(result.isActive).toBe(false);
    });

    it("throws AdminConflictException when already inactive", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1", isActive: false }));

      await expect(service.deactivate(auth, "s1")).rejects.toThrow(
        AdminConflictException,
      );
    });
  });

  describe("archive (softDelete)", () => {
    it("archives a school without business data", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1" }));
      schoolRepo.setBusinessData("s1", false);

      const result = await service.archive(auth, "s1");
      expect(result.archived).toBe(true);
      expect(result.id).toBe("s1");
    });

    it("rejects archive when school has business data", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1" }));
      schoolRepo.setBusinessData("s1", true);

      await expect(service.archive(auth, "s1")).rejects.toThrow(
        AdminConflictException,
      );
    });

    it("throws AdminNotFoundException when school not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(service.archive(auth, "nonexistent")).rejects.toThrow(
        AdminNotFoundException,
      );
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1" }));

      await expect(service.archive(auth, "s1")).rejects.toThrow(
        AdminForbiddenException,
      );
    });
  });

  describe("getUsageStats", () => {
    it("returns usage stats for a school", async () => {
      const auth = platformAdminAuth(schoolId);
      schoolRepo.add(adminSchool({ id: "s1" }));
      metricsPort.setSchoolUsageStats("s1", {
        membershipCount: 30,
        classCount: 5,
        courseCount: 12,
        assignmentCount: 80,
        submissionCount: 300,
      });

      const result = await service.getUsageStats(auth, "s1");
      expect(result.membershipCount).toBe(30);
      expect(result.classCount).toBe(5);
      expect(result.courseCount).toBe(12);
    });

    it("throws AdminNotFoundException for missing school", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.getUsageStats(auth, "nonexistent"),
      ).rejects.toThrow(AdminNotFoundException);
    });
  });

  describe("fail-closed with unavailable repositories", () => {
    it("throws when school repository is unavailable", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AdminModule],
      })
        .overrideProvider(ADMIN_METRICS_PORT)
        .useValue(metricsPort)
        .overrideProvider(ADMIN_SCHOOL_REPOSITORY)
        .useClass(UnavailableAdminSchoolRepository)
        .compile();
      const svc = moduleRef.get(SchoolsService);
      const auth = platformAdminAuth(schoolId);

      await expect(svc.list(auth, { limit: 10 })).rejects.toThrow();
    });
  });
});
