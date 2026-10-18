import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../../../src/common/security/index.js";
import { AssignmentsModule } from "../../../src/modules/assignments/assignments.module.js";
import { AssignmentsService } from "../../../src/modules/assignments/assignments.service.js";
import { ASSIGNMENT_REPOSITORY } from "../../../src/modules/assignments/ports/assignment-repository.port.js";
import { ASSIGNMENT_LOOKUP } from "../../../src/modules/assignments/ports/assignment-lookup.port.js";
import {
  createFakeDatabaseModule,
  createFakePrismaService,
} from "../../helpers/fake-prisma.service.js";
import { FakeAssignmentRepository } from "./fakes/fake-assignment.repository.js";
import { assignment } from "./fixtures/assignments.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext(
    "req-1",
    {
      userId,
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    },
    { schoolId },
  );
}

describe("AssignmentsService", () => {
  let service: AssignmentsService;
  let repo: FakeAssignmentRepository;
  let targetEnrollmentsFindMany: ReturnType<typeof vi.fn>;
  let assignmentSubmissionsFindMany: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    repo = new FakeAssignmentRepository();
    targetEnrollmentsFindMany = vi.fn().mockImplementation(async ({ where }: any) => {
      if (where.userId === "teacher-1") return [{ classId: "class-1" }];
      if (where.id?.in) return where.id.in.map((id: string) => ({ id, classId: "class-1" }));
      return [];
    });
    assignmentSubmissionsFindMany = vi.fn().mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      imports: [
        createFakeDatabaseModule(
          createFakePrismaService({
            courseVersion: { findFirst: async () => ({ id: "cv-1" }) },
            class: { findFirst: async () => ({ id: "class-1" }) },
            enrollment: {
              findFirst: async () => ({
                id: "teacher-enrollment",
                classId: "class-1",
              }),
              findMany: targetEnrollmentsFindMany,
            },
            submission: { findMany: assignmentSubmissionsFindMany },
          }),
        ),
        AssignmentsModule,
      ],
    })
      .overrideProvider(ASSIGNMENT_REPOSITORY)
      .useValue(repo)
      .overrideProvider(ASSIGNMENT_LOOKUP)
      .useValue({
        findSummaryById: async () => null,
        isOpen: async () => false,
        listByEnrollment: async () => [],
      })
      .compile();

    service = moduleRef.get(AssignmentsService);
  });

  const schoolId = "school-a";
  const teacherAuth = auth("teacher-1", schoolId, [MembershipRole.TEACHER]);
  const studentAuth = auth("student-1", schoolId, [MembershipRole.STUDENT]);
  const adminAuth = auth("admin-1", schoolId, [MembershipRole.SCHOOL_ADMIN]);

  describe("createAssignment", () => {
    it("creates assignment as teacher", async () => {
      const result = await service.createAssignment(teacherAuth, schoolId, {
        schoolId,
        courseVersionId: "cv-1",
        title: "Math Homework",
        startsAt: new Date(),
        dueAt: new Date(Date.now() + 86400000),
        targets: [{ targetType: "CLASS", classId: "class-1" }],
      });
      expect(result.title).toBe("Math Homework");
      expect(result.status).toBe("DRAFT");
    });

    it("rejects student creating assignment", async () => {
      await expect(
        service.createAssignment(studentAuth, schoolId, {
          schoolId,
          courseVersionId: "cv-1",
          title: "Test",
          startsAt: new Date(),
          dueAt: new Date(Date.now() + 86400000),
          targets: [{ targetType: "CLASS", classId: "class-1" }],
        }),
      ).rejects.toThrow();
    });
  });

  describe("getAssignment", () => {
    it("returns assignment for teacher", async () => {
      const created = await service.createAssignment(teacherAuth, schoolId, {
        schoolId,
        courseVersionId: "cv-1",
        title: "Test",
        startsAt: new Date(),
        dueAt: new Date(Date.now() + 86400000),
        targets: [{ targetType: "CLASS", classId: "class-1" }],
      });

      const result = await service.getAssignment(
        teacherAuth,
        schoolId,
        created.id,
      );
      expect(result.id).toBe(created.id);
    });

    it("throws for non-existent assignment", async () => {
      await expect(
        service.getAssignment(teacherAuth, schoolId, "nonexistent"),
      ).rejects.toThrow();
    });
  });

  describe("getAssignmentStats", () => {
    it("deduplicates overlapping targets and counts each student's latest real submission", async () => {
      const base = assignment({ schoolId });
      repo.add({
        ...base,
        targets: [
          ...base.targets,
          {
            id: "individual-target",
            schoolId,
            assignmentId: base.id,
            targetType: "STUDENT",
            enrollmentId: "student-enrollment-1",
          },
        ],
      });
      targetEnrollmentsFindMany.mockImplementation(async ({ where }: any) => {
        if (where.userId === "teacher-1") return [{ classId: "class-1" }];
        return [
          { id: "student-enrollment-1", classId: "class-1" },
          { id: "student-enrollment-2", classId: "class-1" },
        ];
      });
      assignmentSubmissionsFindMany.mockResolvedValue([
        { enrollmentId: "student-enrollment-1", status: "NEEDS_REVIEW", attemptNo: 2 },
        { enrollmentId: "student-enrollment-1", status: "REVIEWED", attemptNo: 1 },
        { enrollmentId: "student-enrollment-2", status: "IN_PROGRESS", attemptNo: 1 },
      ]);

      const result = await service.getAssignmentStats(teacherAuth, schoolId, base.id);

      expect(result).toMatchObject({
        totalStudents: 2,
        submittedCount: 1,
        notSubmittedCount: 1,
        reviewedCount: 0,
        needsReviewCount: 1,
        submissionRate: 50,
      });
      expect(assignmentSubmissionsFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ enrollmentId: { in: ["student-enrollment-1", "student-enrollment-2"] } }),
      }));
    });
  });

  describe("updateAssignment", () => {
    it("updates DRAFT assignment", async () => {
      const created = await service.createAssignment(teacherAuth, schoolId, {
        schoolId,
        courseVersionId: "cv-1",
        title: "Test",
        startsAt: new Date(),
        dueAt: new Date(Date.now() + 86400000),
        targets: [{ targetType: "CLASS", classId: "class-1" }],
      });

      const updated = await service.updateAssignment(
        teacherAuth,
        schoolId,
        created.id,
        { title: "Updated" },
        created.revision,
      );
      expect(updated.title).toBe("Updated");
    });

    it("rejects update for non-DRAFT assignment", async () => {
      const a = assignment({ schoolId, status: "OPEN" });
      repo.add(a);

      await expect(
        service.updateAssignment(
          teacherAuth,
          schoolId,
          a.id,
          { title: "X" },
          a.revision,
        ),
      ).rejects.toThrow();
    });
  });

  describe("openAssignment", () => {
    it("transitions SCHEDULED -> OPEN", async () => {
      const a = assignment({ schoolId, status: "SCHEDULED", revision: 1 });
      repo.add(a);

      const result = await service.openAssignment(
        adminAuth,
        schoolId,
        a.id,
        a.revision,
      );
      expect(result.status).toBe("OPEN");
    });

    it("rejects DRAFT -> OPEN (must go via SCHEDULED)", async () => {
      const a = assignment({ schoolId, status: "DRAFT", revision: 1 });
      repo.add(a);

      await expect(
        service.openAssignment(adminAuth, schoolId, a.id, a.revision),
      ).rejects.toThrow();
    });
  });

  describe("closeAssignment", () => {
    it("transitions OPEN -> CLOSED", async () => {
      const a = assignment({ schoolId, status: "OPEN", revision: 1 });
      repo.add(a);

      const result = await service.closeAssignment(
        adminAuth,
        schoolId,
        a.id,
        a.revision,
      );
      expect(result.status).toBe("CLOSED");
    });
  });

  describe("deleteAssignment", () => {
    it("allows SCHOOL_ADMIN to delete", async () => {
      const a = assignment({ schoolId, status: "DRAFT" });
      repo.add(a);

      await service.deleteAssignment(adminAuth, schoolId, a.id);
      // Should not throw
    });

    it("rejects teacher deleting assignment", async () => {
      const a = assignment({ schoolId, status: "DRAFT" });
      repo.add(a);

      await expect(
        service.deleteAssignment(teacherAuth, schoolId, a.id),
      ).rejects.toThrow();
    });
  });
});
