import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../../../src/common/security/index.js";
import { PrismaService } from "../../../src/shared/database/prisma.service.js";
import { FeedbackService } from "../../../src/modules/feedback/feedback.service.js";
import { FEEDBACK_REPOSITORY } from "../../../src/modules/feedback/ports/feedback-repository.port.js";
import { SUBMISSION_LOOKUP } from "../../../src/modules/submissions/ports/submission-lookup.port.js";
import { FakeFeedbackRepository } from "./fakes/fake-feedback.repository.js";
import { FakeSubmissionLookupRepository } from "../submissions/fakes/fake-submission-lookup.repository.js";
import { submissionSummary } from "../submissions/fixtures/submissions.js";
import { feedback } from "./fixtures/feedback.js";

function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
  return createAuthContext("req-1", {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "test",
  }, { schoolId });
}

const mockPrismaService = {
  enrollment: {
    findFirst: async () => ({ userId: "student-1" }),
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const mockTx = {
      feedback: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "fb-tx-1",
          ...data,
          revision: 1,
          releasedAt: new Date(),
        }),
      },
      submission: {
        updateMany: async () => ({ count: 1 }),
      },
    };
    return fn(mockTx);
  },
};

describe("FeedbackService", () => {
  let service: FeedbackService;
  let feedbackRepo: FakeFeedbackRepository;
  let submissionLookup: FakeSubmissionLookupRepository;

  beforeEach(async () => {
    feedbackRepo = new FakeFeedbackRepository();
    submissionLookup = new FakeSubmissionLookupRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: FEEDBACK_REPOSITORY, useValue: feedbackRepo },
        { provide: SUBMISSION_LOOKUP, useValue: submissionLookup },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = moduleRef.get(FeedbackService);
  });

  const schoolId = "school-a";
  const teacherAuth = auth("teacher-1", schoolId, [MembershipRole.TEACHER]);
  const studentAuth = auth("student-1", schoolId, [MembershipRole.STUDENT]);

  describe("createFeedback", () => {
    it("creates feedback for NEEDS_REVIEW submission", async () => {
      const s = submissionSummary({
        id: "sub-1",
        schoolId,
        enrollmentId: "enrollment-1",
        status: "NEEDS_REVIEW",
      });
      submissionLookup.add(s);

      const result = await service.createFeedback(
        teacherAuth, schoolId, "sub-1",
        { decision: "ACCEPT", comment: "Great work!" },
      );
      expect(result.decision).toBe("ACCEPT");
      expect(result.comment).toBe("Great work!");
    });

    it("rejects feedback on non-NEEDS_REVIEW submission", async () => {
      const s = submissionSummary({
        id: "sub-2",
        schoolId,
        enrollmentId: "enrollment-1",
        status: "IN_PROGRESS",
      });
      submissionLookup.add(s);

      await expect(
        service.createFeedback(teacherAuth, schoolId, "sub-2", {
          decision: "ACCEPT",
          comment: "Test",
        }),
      ).rejects.toThrow();
    });

    it("rejects student creating feedback", async () => {
      const s = submissionSummary({
        id: "sub-3",
        schoolId,
        enrollmentId: "enrollment-1",
        status: "NEEDS_REVIEW",
      });
      submissionLookup.add(s);

      await expect(
        service.createFeedback(studentAuth, schoolId, "sub-3", {
          decision: "RETURN",
          comment: "Try again",
        }),
      ).rejects.toThrow();
    });
  });

  describe("getFeedbackBySubmission", () => {
    it("returns feedback for a submission", async () => {
      const s = submissionSummary({
        id: "sub-4",
        schoolId,
        enrollmentId: "enrollment-1",
        status: "NEEDS_REVIEW",
      });
      submissionLookup.add(s);

      const f = feedback({ schoolId, submissionId: "sub-4" });
      feedbackRepo.add(f);

      const result = await service.getFeedbackBySubmission(
        teacherAuth, schoolId, "sub-4",
      );
      expect(result.length).toBe(1);
    });

    it("resolves the enrollment owner before authorizing student feedback", async () => {
      const s = submissionSummary({
        id: "sub-student",
        schoolId,
        enrollmentId: "enrollment-1",
        status: "ACCEPTED",
      });
      submissionLookup.add(s);
      feedbackRepo.add(feedback({ schoolId, submissionId: s.id }));

      const result = await service.getFeedbackBySubmission(
        studentAuth,
        schoolId,
        s.id,
      );

      expect(result).toHaveLength(1);
    });

    it("returns empty array for non-existent submission", async () => {
      const result = await service.getFeedbackBySubmission(
        teacherAuth, schoolId, "nonexistent",
      );
      expect(result).toEqual([]);
    });
  });

  describe("listPendingFeedback", () => {
    it("lists pending feedback for teacher", async () => {
      const f = feedback({ schoolId });
      feedbackRepo.add(f);

      const result = await service.listPendingFeedback(
        teacherAuth, schoolId, { limit: 20 },
      );
      expect(result.items.length).toBeGreaterThan(0);
    });

    it("rejects student listing pending feedback", async () => {
      await expect(
        service.listPendingFeedback(studentAuth, schoolId, { limit: 20 }),
      ).rejects.toThrow();
    });
  });
});
