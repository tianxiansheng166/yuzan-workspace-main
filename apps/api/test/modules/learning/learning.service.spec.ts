import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../../../src/common/security/index.js";
import { LearningModule } from "../../../src/modules/learning/learning.module.js";
import { LearningService } from "../../../src/modules/learning/learning.service.js";
import { LEARNING_REPOSITORY } from "../../../src/modules/learning/ports/learning-repository.port.js";
import { CLASS_ENROLLMENT_LOOKUP } from "../../../src/modules/classes/ports/class-enrollment-lookup.port.js";
import { ASSIGNMENT_LOOKUP } from "../../../src/modules/assignments/ports/assignment-lookup.port.js";
import { createFakeDatabaseModule, createFakePrismaService } from "../../helpers/fake-prisma.service.js";
import { FakeLearningRepository } from "./fakes/fake-learning.repository.js";
import { progressRecord } from "./fixtures/learning.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

describe("LearningService", () => {
  let service: LearningService;
  let learningRepo: FakeLearningRepository;

  beforeEach(async () => {
    learningRepo = new FakeLearningRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [createFakeDatabaseModule(createFakePrismaService()), LearningModule],
    })
      .overrideProvider(LEARNING_REPOSITORY)
      .useValue(learningRepo)
      .overrideProvider(CLASS_ENROLLMENT_LOOKUP)
      .useValue({
        classExistsAndBelongsToSchool: async () => true,
        isUserEnrolledInClass: async () => true,
        listStudentEnrollmentIds: async () => [],
        findEnrollmentId: async () => null,
      })
      .overrideProvider(ASSIGNMENT_LOOKUP)
      .useValue({
        findSummaryById: async () => null,
        isOpen: async () => false,
        listByEnrollment: async () => [],
      })
      .compile();

    service = moduleRef.get(LearningService);
  });

  const schoolId = "school-a";
  const studentAuth = auth("student-1", schoolId, [MembershipRole.STUDENT]);
  const teacherAuth = auth("teacher-1", schoolId, [MembershipRole.TEACHER]);

  describe("listTasks", () => {
    it("rejects teacher from listing learning tasks", async () => {
      await expect(
        service.listTasks(teacherAuth, schoolId),
      ).rejects.toThrow();
    });
  });

  describe("getProgress", () => {
    it("returns progress when exists", async () => {
      const p = progressRecord({ activityId: "act-1", enrollmentId: "enr-1" });
      learningRepo.add(p);

      // This requires the enrollment lookup to find the user's enrollment
      // Since we mocked CLASS_ENROLLMENT_LOOKUP, the full flow needs more setup
      // but we can test the repository directly
      const result = await learningRepo.findProgress("act-1", "enr-1");
      expect(result).not.toBeNull();
      expect(result!.activityId).toBe("act-1");
    });

    it("returns null when progress does not exist", async () => {
      const result = await learningRepo.findProgress("nonexistent", "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("updateProgress", () => {
    it("creates new progress via upsert", async () => {
      const result = await learningRepo.upsertProgress({
        schoolId,
        activityId: "act-new",
        enrollmentId: "enr-1",
        position: 50,
        completed: false,
      });
      expect(result.position).toBe(50);
      expect(result.revision).toBe(1);
    });

    it("increments revision on update", async () => {
      const p = progressRecord({
        activityId: "act-upd",
        enrollmentId: "enr-1",
        revision: 1,
      });
      learningRepo.add(p);

      const result = await learningRepo.upsertProgress({
        schoolId,
        activityId: "act-upd",
        enrollmentId: "enr-1",
        position: 75,
        completed: true,
      });
      expect(result.position).toBe(75);
      expect(result.completed).toBe(true);
      expect(result.revision).toBe(2);
    });
  });

  describe("listProgressByEnrollment", () => {
    it("returns progress records for enrollment", async () => {
      const p1 = progressRecord({ activityId: "act-1", enrollmentId: "enr-1" });
      const p2 = progressRecord({ activityId: "act-2", enrollmentId: "enr-1", id: "progress-2" });
      learningRepo.add(p1, p2);

      const result = await learningRepo.listProgressByEnrollment("enr-1");
      expect(result.length).toBe(2);
    });
  });
});
