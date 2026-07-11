import { beforeEach, describe, expect, it } from "vitest";
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
import { FakeAssignmentRepository } from "./fakes/fake-assignment.repository.js";
import { assignment } from "./fixtures/assignments.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

describe("AssignmentsService", () => {
  let service: AssignmentsService;
  let repo: FakeAssignmentRepository;

  beforeEach(async () => {
    repo = new FakeAssignmentRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AssignmentsModule],
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

      const result = await service.getAssignment(teacherAuth, schoolId, created.id);
      expect(result.id).toBe(created.id);
    });

    it("throws for non-existent assignment", async () => {
      await expect(
        service.getAssignment(teacherAuth, schoolId, "nonexistent"),
      ).rejects.toThrow();
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
        teacherAuth, schoolId, created.id,
        { title: "Updated" },
        created.revision,
      );
      expect(updated.title).toBe("Updated");
    });

    it("rejects update for non-DRAFT assignment", async () => {
      const a = assignment({ schoolId, status: "OPEN" });
      repo.add(a);

      await expect(
        service.updateAssignment(teacherAuth, schoolId, a.id, { title: "X" }, a.revision),
      ).rejects.toThrow();
    });
  });

  describe("openAssignment", () => {
    it("transitions SCHEDULED -> OPEN", async () => {
      const a = assignment({ schoolId, status: "SCHEDULED", revision: 1 });
      repo.add(a);

      const result = await service.openAssignment(
        adminAuth, schoolId, a.id, a.revision,
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
        adminAuth, schoolId, a.id, a.revision,
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
