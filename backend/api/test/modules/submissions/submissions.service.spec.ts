import { beforeEach, describe, expect, it } from "vitest";
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
import {
  createFakeDatabaseModule,
  createFakePrismaService,
} from "../../helpers/fake-prisma.service.js";
import { FakeStoragePort } from "../../helpers/fake-storage.port.js";
import { FakeSubmissionRepository } from "./fakes/fake-submission.repository.js";
import { FakeSubmissionLookupRepository } from "./fakes/fake-submission-lookup.repository.js";
import { submission } from "./fixtures/submissions.js";

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

describe("SubmissionsService", () => {
  let service: SubmissionsService;
  let repo: FakeSubmissionRepository;
  let lookup: FakeSubmissionLookupRepository;
  let evidenceState: {
    attempts: Array<{ value: unknown }>;
    recordings: Array<{
      id: string;
      status: string;
      objectKey: string;
      durationMs: number;
    }>;
    feedback: {
      id: string;
      decision: string;
      comment: string;
      score: number | null;
      revision: number;
      releasedAt: Date;
    } | null;
  };

  beforeEach(async () => {
    repo = new FakeSubmissionRepository();
    lookup = new FakeSubmissionLookupRepository();
    evidenceState = { attempts: [], recordings: [], feedback: null };
    const prisma = createFakePrismaService({
      enrollment: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          if (args.where.id) {
            return {
              userId: "student-1",
              classId: "class-a",
            };
          }
          if (
            args.where.role === "TEACHER" &&
            args.where.userId === "teacher-1" &&
            args.where.classId === "class-a"
          ) {
            return { id: "teacher-enrollment-a" };
          }
          return null;
        },
      },
      activityAttempt: {
        findMany: async () => evidenceState.attempts,
      },
      assessmentSession: {
        findMany: async () => [],
      },
      recording: {
        findMany: async () => evidenceState.recordings,
      },
      feedback: {
        findFirst: async () => evidenceState.feedback,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [createFakeDatabaseModule(prisma), SubmissionsModule],
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
  const otherStudentAuth = auth("student-2", schoolId, [
    MembershipRole.STUDENT,
  ]);
  const teacherAuth = auth("teacher-1", schoolId, [MembershipRole.TEACHER]);
  const otherTeacherAuth = auth("teacher-2", schoolId, [
    MembershipRole.TEACHER,
  ]);

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
        studentAuth,
        schoolId,
        created.id,
        0,
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
    it("lists submissions for teacher", async () => {
      const s = submission({ schoolId, assignmentId: "assignment-1" });
      repo.add(s);

      const result = await service.listAssignmentSubmissions(
        teacherAuth,
        schoolId,
        "assignment-1",
        { limit: 20 },
      );
      expect(result.items.length).toBeGreaterThan(0);
    });

    it("rejects student listing assignment submissions", async () => {
      await expect(
        service.listAssignmentSubmissions(
          studentAuth,
          schoolId,
          "assignment-1",
          { limit: 20 },
        ),
      ).rejects.toThrow();
    });
  });

  describe("getSubmission", () => {
    it("returns submission by id", async () => {
      const s = submission({ schoolId });
      repo.add(s);

      const result = await service.getSubmission(studentAuth, schoolId, s.id);
      expect(result.id).toBe(s.id);
    });

    it("denies a student who does not own the submission", async () => {
      const s = submission({ schoolId, enrollmentId: "enrollment-1" });
      repo.add(s);

      await expect(
        service.getSubmission(otherStudentAuth, schoolId, s.id),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("denies a teacher outside the student's class", async () => {
      const s = submission({ schoolId, enrollmentId: "enrollment-1" });
      repo.add(s);

      await expect(
        service.getSubmission(otherTeacherAuth, schoolId, s.id),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("returns real evidence and persisted feedback to the scoped teacher", async () => {
      const s = submission({
        schoolId,
        enrollmentId: "enrollment-1",
        status: "RETURNED",
        revision: 8,
      });
      repo.add(s);
      evidenceState.attempts = [{ value: { answer: "春风又绿江南岸" } }];
      evidenceState.recordings = [
        {
          id: "recording-1",
          status: "READY",
          objectKey: "recordings/recording-1/full",
          durationMs: 12_300,
        },
      ];
      evidenceState.feedback = {
        id: "feedback-1",
        decision: "RETURN",
        comment: "请重读第二句并补充停顿。",
        score: null,
        revision: 1,
        releasedAt: new Date("2026-07-26T12:00:00.000Z"),
      };

      const result = await service.getSubmission(teacherAuth, schoolId, s.id);

      expect(result).toMatchObject({
        id: s.id,
        status: "RETURNED",
        revision: 8,
        writtenAnswer: "春风又绿江南岸",
        recordingId: "recording-1",
        recordingDuration: 12,
        feedback: {
          decision: "RETURN",
          comment: "请重读第二句并补充停顿。",
        },
      });
      expect(result.recordingUrl).toContain("recordings%2Frecording-1%2Ffull");
    });

    it("throws for non-existent submission", async () => {
      await expect(
        service.getSubmission(studentAuth, schoolId, "nonexistent"),
      ).rejects.toThrow();
    });
  });
});
