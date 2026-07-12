import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { GovernanceService } from "../../src/modules/curriculum-governance/governance.service.js";
import { CurriculumGovernanceModule } from "../../src/modules/curriculum-governance/curriculum-governance.module.js";
import { GOVERNANCE_REPOSITORY } from "../../src/modules/curriculum-governance/ports/governance-repository.port.js";
import { GOVERNANCE_REVIEW_REPOSITORY } from "../../src/modules/curriculum-governance/ports/governance-review-repository.port.js";
import { FakeGovernanceRepository } from "./fakes/fake-governance.repository.js";
import { FakeGovernanceReviewRepository } from "./fakes/fake-governance-review.repository.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";
import {
  GovernanceForbiddenException,
  GovernanceNotFoundException,
  GovernanceConflictException,
} from "../../src/modules/curriculum-governance/domain/governance.errors.js";
import { governanceCourseVersion } from "./fixtures/governance-versions.js";

describe("GovernanceService", () => {
  let service: GovernanceService;
  let govRepo: FakeGovernanceRepository;
  let reviewRepo: FakeGovernanceReviewRepository;
  const schoolId = "school-a";

  beforeEach(async () => {
    govRepo = new FakeGovernanceRepository();
    reviewRepo = new FakeGovernanceReviewRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [CurriculumGovernanceModule],
    })
      .overrideProvider(GOVERNANCE_REPOSITORY)
      .useValue(govRepo)
      .overrideProvider(GOVERNANCE_REVIEW_REPOSITORY)
      .useValue(reviewRepo)
      .compile();

    service = moduleRef.get(GovernanceService);
  });

  describe("listAllVersions", () => {
    it("returns filtered versions by status", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "IN_REVIEW" }),
        governanceCourseVersion({ id: "v2", schoolId: "school-a", courseId: "c2", status: "DRAFT" }),
      );

      const result = await service.listAllVersions(auth, {
        limit: 10,
        status: "IN_REVIEW",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("v1");
    });

    it("returns filtered versions by schoolId", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1" }),
        governanceCourseVersion({ id: "v2", schoolId: "school-b", courseId: "c2" }),
      );

      const result = await service.listAllVersions(auth, {
        limit: 10,
        schoolId: "school-a",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe("v1");
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(
        service.listAllVersions(auth, { limit: 10 }),
      ).rejects.toThrow(GovernanceForbiddenException);
    });
  });

  describe("findById", () => {
    it("returns version for same school", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", title: "版本A" }),
      );

      const result = await service.findById(auth, "school-a", "v1");
      expect(result.id).toBe("v1");
      expect(result.title).toBe("版本A");
    });

    it("throws GovernanceNotFoundException for cross-tenant access", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-b", courseId: "c1" }),
      );

      await expect(
        service.findById(auth, "school-a", "v1"),
      ).rejects.toThrow(GovernanceNotFoundException);
    });

    it("throws GovernanceNotFoundException for nonexistent id", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.findById(auth, "school-a", "nonexistent"),
      ).rejects.toThrow(GovernanceNotFoundException);
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1" }),
      );

      await expect(
        service.findById(auth, "school-a", "v1"),
      ).rejects.toThrow(GovernanceForbiddenException);
    });
  });

  describe("reviewVersion", () => {
    it("transitions IN_REVIEW to APPROVED via APPROVE decision", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "IN_REVIEW" }),
      );

      const result = await service.reviewVersion(auth, "school-a", "v1", "APPROVE", "Approved");
      expect(result.status).toBe("APPROVED");
      expect(result.approvedAt).toBeInstanceOf(Date);
    });

    it("transitions IN_REVIEW to CHANGES_REQUESTED via REQUEST_CHANGES decision", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "IN_REVIEW" }),
      );

      const result = await service.reviewVersion(auth, "school-a", "v1", "REQUEST_CHANGES", "Needs changes");
      expect(result.status).toBe("CHANGES_REQUESTED");
    });

    it("transitions IN_REVIEW to DRAFT via REJECT decision", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "IN_REVIEW" }),
      );

      const result = await service.reviewVersion(auth, "school-a", "v1", "REJECT", "Rejected");
      expect(result.status).toBe("DRAFT");
    });

    it("rejects invalid transition from DRAFT to APPROVED", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "DRAFT" }),
      );

      await expect(
        service.reviewVersion(auth, "school-a", "v1", "APPROVE"),
      ).rejects.toThrow(GovernanceConflictException);
    });

    it("rejects invalid transition from PUBLISHED to APPROVED", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "PUBLISHED" }),
      );

      await expect(
        service.reviewVersion(auth, "school-a", "v1", "APPROVE"),
      ).rejects.toThrow(GovernanceConflictException);
    });

    it("rejects school_admin from reviewing", async () => {
      const auth = schoolAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "IN_REVIEW" }),
      );

      await expect(
        service.reviewVersion(auth, "school-a", "v1", "APPROVE"),
      ).rejects.toThrow(GovernanceForbiddenException);
    });
  });

  describe("publishVersion", () => {
    it("transitions APPROVED to PUBLISHED", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "APPROVED" }),
      );

      const result = await service.publishVersion(auth, "school-a", "v1");
      expect(result.status).toBe("PUBLISHED");
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it("allows school_admin to publish", async () => {
      const auth = schoolAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "APPROVED" }),
      );

      const result = await service.publishVersion(auth, "school-a", "v1");
      expect(result.status).toBe("PUBLISHED");
    });

    it("rejects publishing a DRAFT version", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "DRAFT" }),
      );

      await expect(
        service.publishVersion(auth, "school-a", "v1"),
      ).rejects.toThrow(GovernanceConflictException);
    });

    it("rejects teacher from publishing", async () => {
      const auth = teacherAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "APPROVED" }),
      );

      await expect(
        service.publishVersion(auth, "school-a", "v1"),
      ).rejects.toThrow(GovernanceForbiddenException);
    });
  });

  describe("retireVersion", () => {
    it("transitions PUBLISHED to RETIRED", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "PUBLISHED" }),
      );

      const result = await service.retireVersion(auth, "school-a", "v1");
      expect(result.status).toBe("RETIRED");
      expect(result.retiredAt).toBeInstanceOf(Date);
    });

    it("rejects retiring an APPROVED version", async () => {
      const auth = platformAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "APPROVED" }),
      );

      await expect(
        service.retireVersion(auth, "school-a", "v1"),
      ).rejects.toThrow(GovernanceConflictException);
    });

    it("rejects school_admin from retiring", async () => {
      const auth = schoolAdminAuth(schoolId);
      govRepo.add(
        governanceCourseVersion({ id: "v1", schoolId: "school-a", courseId: "c1", status: "PUBLISHED" }),
      );

      await expect(
        service.retireVersion(auth, "school-a", "v1"),
      ).rejects.toThrow(GovernanceForbiddenException);
    });
  });

  describe("optimistic concurrency", () => {
    it("throws conflict when expectedUpdatedAt does not match", async () => {
      const auth = platformAdminAuth(schoolId);
      const version = governanceCourseVersion({
        id: "v1",
        schoolId: "school-a",
        courseId: "c1",
        status: "IN_REVIEW",
      });
      govRepo.add(version);

      // Use a hook to simulate a concurrent write between
      // the workflow's findById and updateStatus calls.
      govRepo.beforeUpdateHook = () => {
        govRepo.addInternal({
          ...version,
          updatedAt: new Date("2026-07-11T00:00:00Z"),
        });
      };

      await expect(
        service.reviewVersion(auth, "school-a", "v1", "APPROVE"),
      ).rejects.toThrow(GovernanceConflictException);

      govRepo.beforeUpdateHook = null;
    });
  });

  describe("fail-closed with unavailable repositories", () => {
    it("throws when governance repository is unavailable", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CurriculumGovernanceModule],
      }).compile();
      const svc = moduleRef.get(GovernanceService);
      const auth = platformAdminAuth(schoolId);

      await expect(
        svc.listAllVersions(auth, { limit: 10 }),
      ).rejects.toThrow(GovernanceNotFoundException);
    });
  });
});
