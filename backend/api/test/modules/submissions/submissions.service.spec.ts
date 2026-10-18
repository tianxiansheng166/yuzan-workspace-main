import { beforeEach, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../../../src/common/security/index.js";
import { SubmissionsModule } from "../../../src/modules/submissions/submissions.module.js";
import { SubmissionsService } from "../../../src/modules/submissions/submissions.service.js";
import { SUBMISSION_REPOSITORY } from "../../../src/modules/submissions/ports/submission-repository.port.js";
import { SUBMISSION_LOOKUP } from "../../../src/modules/submissions/ports/submission-lookup.port.js";
import { STORAGE_PORT } from "../../../src/shared/storage/storage.port.js";
import { createFakeDatabaseModule, createFakePrismaService } from "../../helpers/fake-prisma.service.js";
import { FakeStoragePort } from "../../helpers/fake-storage.port.js";
import { FakeSubmissionRepository } from "./fakes/fake-submission.repository.js";
import { FakeSubmissionLookupRepository } from "./fakes/fake-submission-lookup.repository.js";
import { submission } from "./fixtures/submissions.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

describe("SubmissionsService", () => {
  let service: SubmissionsService;
  let repo: FakeSubmissionRepository;
  let lookup: FakeSubmissionLookupRepository;
  let enrollmentFindFirst: ReturnType<typeof vi.fn>;
  let enrollmentFindMany: ReturnType<typeof vi.fn>;
  let assignmentFindFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    repo = new FakeSubmissionRepository();
    lookup = new FakeSubmissionLookupRepository();
    enrollmentFindFirst = vi.fn().mockImplementation(async ({ where }: any) => where.role === "TEACHER" ? { id: "teacher-enrollment" } : null);
    enrollmentFindMany = vi.fn().mockResolvedValue([]);
    assignmentFindFirst = vi.fn().mockImplementation(async (args: any) => args.select?.targets
      ? { targets: [{ targetType: "CLASS", classId: "class-1", enrollmentId: null }] }
      : null);

    const moduleRef = await Test.createTestingModule({
      imports: [createFakeDatabaseModule(createFakePrismaService({
        enrollment: { findFirst: enrollmentFindFirst, findMany: enrollmentFindMany },
        assignment: { findFirst: assignmentFindFirst },
      })), SubmissionsModule],
    })
      .overrideProvider(SUBMISSION_REPOSITORY)
      .useValue(repo)
      .overrideProvider(SUBMISSION_LOOKUP)
      .useValue(lookup)
      .overrideProvider(STORAGE_PORT)
      .useValue(new FakeStoragePort())
      .compile();

    service = moduleRef.get(SubmissionsService);
  });

  const schoolId = "school-a";
  const studentAuth = auth("student-1", schoolId, [MembershipRole.STUDENT]);
  const teacherAuth = auth("teacher-1", schoolId, [MembershipRole.TEACHER]);

  describe("createSubmission", () => {
    it("creates submission as student", async () => {
      const result = await service.createSubmission(studentAuth, schoolId, {
        schoolId,
        assignmentId: "assignment-1",
        enrollmentId: "enrollment-1",
        idempotencyKey: "idem-1",
      });
      expect(result.status).toBe("IN_PROGRESS");
    });

    it("returns same submission on duplicate idempotencyKey", async () => {
      const first = await service.createSubmission(studentAuth, schoolId, {
        schoolId,
        assignmentId: "assignment-1",
        enrollmentId: "enrollment-1",
        idempotencyKey: "idem-dup",
      });

      const second = await service.createSubmission(studentAuth, schoolId, {
        schoolId,
        assignmentId: "assignment-1",
        enrollmentId: "enrollment-1",
        idempotencyKey: "idem-dup",
      });

      expect(second.id).toBe(first.id);
    });

    it("rejects teacher creating submission", async () => {
      await expect(
        service.createSubmission(teacherAuth, schoolId, {
          schoolId,
          assignmentId: "assignment-1",
          enrollmentId: "enrollment-1",
          idempotencyKey: "idem-2",
        }),
      ).rejects.toThrow();
    });
  });

  describe("submitSubmission", () => {
    it("transitions IN_PROGRESS -> SUBMITTED", async () => {
      const created = await service.createSubmission(studentAuth, schoolId, {
        schoolId,
        assignmentId: "assignment-1",
        enrollmentId: "enrollment-1",
        idempotencyKey: "idem-sub",
      });

      const result = await service.submitSubmission(
        studentAuth, schoolId, created.id, 0,
      );
      expect(result.status).toBe("SUBMITTED");
    });

    it("rejects invalid state transition", async () => {
      const s = submission({ schoolId, status: "ACCEPTED", revision: 1 });
      repo.add(s);

      await expect(
        service.submitSubmission(studentAuth, schoolId, s.id, s.revision),
      ).rejects.toThrow();
    });
  });

  describe("listAssignmentSubmissions", () => {
    it("lists only submissions for the authorized assignment targets", async () => {
      const targetSubmission = submission({ schoolId, assignmentId: "assignment-1", enrollmentId: "enrollment-1" });
      const foreignSubmission = submission({ id: "submission-foreign", schoolId, assignmentId: "assignment-1", enrollmentId: "enrollment-2" });
      repo.add(targetSubmission, foreignSubmission);
      enrollmentFindMany.mockResolvedValueOnce([{ id: "enrollment-1" }]);

      const result = await service.listAssignmentSubmissions(
        teacherAuth, schoolId, "assignment-1", { limit: 20 },
      );
      expect(result.items.map((item) => item.id)).toEqual([targetSubmission.id]);
    });

    it("rejects a teacher who is not assigned to the target class", async () => {
      assignmentFindFirst.mockResolvedValueOnce({
        targets: [{ targetType: "CLASS", classId: "other-class", enrollmentId: null }],
      });
      enrollmentFindFirst.mockResolvedValueOnce(null);

      await expect(service.listAssignmentSubmissions(
        teacherAuth, schoolId, "assignment-1", { limit: 20 },
      )).rejects.toThrow(/目标班级/);
    });

    it("rejects student listing assignment submissions", async () => {
      await expect(
        service.listAssignmentSubmissions(
          studentAuth, schoolId, "assignment-1", { limit: 20 },
        ),
      ).rejects.toThrow();
    });
  });

  describe("getSubmission", () => {
    it("returns submission context to its student", async () => {
      const s = submission({ schoolId });
      repo.add(s);
      enrollmentFindFirst.mockResolvedValue({
        id: s.enrollmentId,
        classId: "class-1",
        userId: "student-1",
        user: { displayName: "测试学生" },
      });
      assignmentFindFirst.mockResolvedValue({ title: "测试任务" });

      const result = await service.getSubmission(studentAuth, schoolId, s.id);
      expect(result).toMatchObject({ id: s.id, studentName: "测试学生", assignmentTitle: "测试任务" });
    });

    it("allows a teacher to read a submission from their own class", async () => {
      const s = submission({ schoolId });
      repo.add(s);
      enrollmentFindFirst
        .mockResolvedValueOnce({
          id: s.enrollmentId,
          classId: "class-1",
          userId: "student-1",
          user: { displayName: "测试学生" },
        })
        .mockResolvedValueOnce({ id: "teacher-enrollment" });
      assignmentFindFirst.mockResolvedValue({ title: "测试任务" });

      const result = await service.getSubmission(teacherAuth, schoolId, s.id);
      expect(result).toMatchObject({ id: s.id, studentName: "测试学生", assignmentTitle: "测试任务" });
    });

    it("does not expose another class submission to a teacher", async () => {
      const s = submission({ schoolId });
      repo.add(s);
      enrollmentFindFirst.mockResolvedValueOnce({
        id: s.enrollmentId,
        classId: "other-class",
        userId: "student-1",
        user: { displayName: "其他班级学生" },
      });
      enrollmentFindFirst.mockResolvedValueOnce(null);

      await expect(service.getSubmission(teacherAuth, schoolId, s.id)).rejects.toThrow();
      expect(assignmentFindFirst).not.toHaveBeenCalled();
    });

    it("does not expose another student's submission", async () => {
      const s = submission({ schoolId });
      repo.add(s);
      enrollmentFindFirst.mockResolvedValue({
        id: s.enrollmentId,
        classId: "class-1",
        userId: "another-student",
        user: { displayName: "其他学生" },
      });

      await expect(service.getSubmission(studentAuth, schoolId, s.id)).rejects.toThrow();
      expect(assignmentFindFirst).not.toHaveBeenCalled();
    });

    it("throws for non-existent submission", async () => {
      await expect(
        service.getSubmission(studentAuth, schoolId, "nonexistent"),
      ).rejects.toThrow();
    });
  });
});
