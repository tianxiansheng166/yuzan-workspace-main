import { describe, expect, it, beforeEach } from "vitest";
import { ASSESSMENT_MATERIAL_REPOSITORY } from "../../src/modules/privacy/ports/assessment-material-repository.port.js";
import { AssessmentService } from "../../src/modules/privacy/assessment/assessment.service.js";
import {
  MaterialNotFoundException,
  MaterialConflictException,
  MaterialVersionConflictException,
} from "../../src/modules/privacy/domain/assessment.errors.js";
import { FakeAssessmentMaterialRepository } from "./fakes/fake-assessment-material.repository.js";
import { assessmentMaterial } from "./fixtures/assessment.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";

describe("AssessmentService", () => {
  const schoolId = "school-a";
  let repo: FakeAssessmentMaterialRepository;
  let service: AssessmentService;

  beforeEach(() => {
    repo = new FakeAssessmentMaterialRepository();
    service = new AssessmentService(repo as unknown as {
      [key: symbol]: unknown;
    }[typeof ASSESSMENT_MATERIAL_REPOSITORY]);
  });

  describe("create", () => {
    it("saves a new material as DRAFT", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, schoolId, {
        schoolId,
        title: "阅读材料A",
        type: "READING",
      });

      expect(result.status).toBe("DRAFT");
      expect(result.title).toBe("阅读材料A");
      expect(result.type).toBe("READING");
      expect(result.version).toBe(1);
    });

    it("auto-increments version on create", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = assessmentMaterial({
        schoolId,
        type: "READING",
        version: 1,
        status: "PUBLISHED",
      });
      repo.add(existing);

      const result = await service.create(auth, schoolId, {
        schoolId,
        title: "阅读材料B",
        type: "READING",
      });

      expect(result.version).toBe(2);
    });

    it("saves with optional content", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.create(auth, schoolId, {
        schoolId,
        title: "阅读材料A",
        type: "READING",
        content: { text: "内容" },
      });

      expect(result.content).toEqual({ text: "内容" });
    });

    it("rejects unauthorized roles (teacher)", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.create(auth, schoolId, {
          schoolId,
          title: "阅读材料A",
          type: "READING",
        }),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects unauthorized roles (student)", async () => {
      const auth = studentAuth(schoolId);
      await expect(
        service.create(auth, schoolId, {
          schoolId,
          title: "阅读材料A",
          type: "READING",
        }),
      ).rejects.toThrow(MaterialConflictException);
    });
  });

  describe("list", () => {
    it("returns materials with type/status filter", async () => {
      const auth = schoolAdminAuth(schoolId);
      const m1 = assessmentMaterial({
        schoolId,
        type: "READING",
        status: "DRAFT",
      });
      const m2 = assessmentMaterial({
        schoolId,
        type: "WRITTEN_FORM",
        status: "PUBLISHED",
      });
      repo.add(m1, m2);

      const result = await service.list(auth, {
        schoolId,
        limit: 10,
        type: "READING",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.type).toBe("READING");
    });

    it("returns materials filtered by status", async () => {
      const auth = schoolAdminAuth(schoolId);
      const m1 = assessmentMaterial({ schoolId, status: "DRAFT" });
      const m2 = assessmentMaterial({ schoolId, status: "PUBLISHED" });
      repo.add(m1, m2);

      const result = await service.list(auth, {
        schoolId,
        limit: 10,
        status: "DRAFT",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe("DRAFT");
    });

    it("rejects unauthorized roles", async () => {
      const auth = studentAuth(schoolId);
      await expect(
        service.list(auth, { schoolId, limit: 10 }),
      ).rejects.toThrow(MaterialConflictException);
    });
  });

  describe("publish", () => {
    it("transitions DRAFT -> PUBLISHED", async () => {
      const auth = platformAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
      });
      repo.add(material);

      const result = await service.publish(auth, schoolId, material.id);

      expect(result.status).toBe("PUBLISHED");
      expect(result.publishedAt).not.toBeNull();
    });

    it("rejects double-publish", async () => {
      const auth = platformAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "PUBLISHED",
      });
      repo.add(material);

      await expect(
        service.publish(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects publish of archived material", async () => {
      const auth = platformAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "ARCHIVED",
      });
      repo.add(material);

      await expect(
        service.publish(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects non-platform-admin (school_admin cannot publish)", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
      });
      repo.add(material);

      await expect(
        service.publish(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("throws when material not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.publish(auth, schoolId, "non-existent-id"),
      ).rejects.toThrow(MaterialNotFoundException);
    });
  });

  describe("archive", () => {
    it("transitions PUBLISHED -> ARCHIVED", async () => {
      const auth = platformAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "PUBLISHED",
      });
      repo.add(material);

      const result = await service.archive(auth, schoolId, material.id);

      expect(result.status).toBe("ARCHIVED");
      expect(result.archivedAt).not.toBeNull();
    });

    it("rejects archive of DRAFT material", async () => {
      const auth = platformAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
      });
      repo.add(material);

      await expect(
        service.archive(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects archive of already archived material", async () => {
      const auth = platformAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "ARCHIVED",
      });
      repo.add(material);

      await expect(
        service.archive(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects non-platform-admin (school_admin cannot archive)", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "PUBLISHED",
      });
      repo.add(material);

      await expect(
        service.archive(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("throws when material not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.archive(auth, schoolId, "non-existent-id"),
      ).rejects.toThrow(MaterialNotFoundException);
    });
  });

  describe("preview", () => {
    it("previews a DRAFT material (school_admin can preview)", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
      });
      repo.add(material);

      const result = await service.preview(auth, schoolId, material.id);

      expect(result.previewedAt).not.toBeNull();
    });

    it("rejects preview of non-DRAFT material", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "PUBLISHED",
      });
      repo.add(material);

      await expect(
        service.preview(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects unauthorized roles", async () => {
      const auth = teacherAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
      });
      repo.add(material);

      await expect(
        service.preview(auth, schoolId, material.id),
      ).rejects.toThrow(MaterialConflictException);
    });
  });

  describe("update", () => {
    it("updates a DRAFT material", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
        title: "原始标题",
      });
      repo.add(material);

      const result = await service.update(auth, schoolId, material.id, {
        title: "更新标题",
        expectedUpdatedAt: material.updatedAt.toISOString(),
      });

      expect(result.title).toBe("更新标题");
    });

    it("rejects update of non-DRAFT material", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "PUBLISHED",
      });
      repo.add(material);

      await expect(
        service.update(auth, schoolId, material.id, {
          title: "更新标题",
          expectedUpdatedAt: material.updatedAt.toISOString(),
        }),
      ).rejects.toThrow(MaterialConflictException);
    });

    it("rejects wrong expectedUpdatedAt", async () => {
      const auth = schoolAdminAuth(schoolId);
      const material = assessmentMaterial({
        schoolId,
        status: "DRAFT",
      });
      repo.add(material);

      const wrongTimestamp = new Date(
        material.updatedAt.getTime() - 10000,
      ).toISOString();

      await expect(
        service.update(auth, schoolId, material.id, {
          title: "更新标题",
          expectedUpdatedAt: wrongTimestamp,
        }),
      ).rejects.toThrow(MaterialVersionConflictException);
    });

    it("throws when material not found", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(
        service.update(auth, schoolId, "non-existent-id", {
          title: "更新标题",
          expectedUpdatedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(MaterialNotFoundException);
    });
  });

  describe("fail-closed with unavailable repository", () => {
    it("throws when repository operations fail", async () => {
      const brokenRepo = new FakeAssessmentMaterialRepository();
      brokenRepo.list = async () => {
        throw new Error("Connection refused");
      };

      const service = new AssessmentService(brokenRepo as unknown as {
        [key: symbol]: unknown;
      }[typeof ASSESSMENT_MATERIAL_REPOSITORY]);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.list(auth, { schoolId, limit: 10 }),
      ).rejects.toThrow("Connection refused");
    });
  });
});
