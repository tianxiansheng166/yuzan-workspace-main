import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";
import { AssessmentReviewService } from "../../src/modules/assessment/assessment-review.service.js";

const SCHOOL_ID = "school-1";
const TEACHER_ID = "teacher-1";

function teacherAuth(): AuthContext {
  return {
    requestId: "review-queue-test",
    principal: {
      userId: TEACHER_ID,
      roles: [MembershipRole.TEACHER],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    },
    tenant: { schoolId: SCHOOL_ID },
  };
}

describe("AssessmentReviewService.listQueue", () => {
  it("returns real item, assignment and submission IDs only within the teacher's class scope", async () => {
    const enrollmentFindMany = vi.fn().mockResolvedValue([{ classId: "class-1" }]);
    type AssessmentItemQueueQuery = {
      where: { session: { classId: { in: string[] } } };
    };
    const assessmentItemQueries: AssessmentItemQueueQuery[] = [];
    const assessmentItemFindMany = vi.fn((args: AssessmentItemQueueQuery) => {
      assessmentItemQueries.push(args);
      return Promise.resolve([
        {
          id: "item-1",
          sessionId: "session-1",
          itemType: "READ_ALOUD",
          maxScore: 10,
          status: "PENDING",
          sortOrder: 0,
          session: {
            status: "PROCESSING",
            classId: "class-1",
            enrollmentId: "student-enrollment-1",
            practiceDefinitionId: null,
            courseSubmissionId: "submission-1",
            courseSubmission: {
              id: "submission-1",
              assignmentId: "assignment-1",
              enrollmentId: "student-enrollment-1",
              assignment: { targets: [{ targetType: "CLASS", classId: "class-1", enrollmentId: null }] },
            },
            enrollment: { user: { displayName: "测试学生" } },
          },
          questionVersion: {
            scoringSpec: { strategy: "SPEECH_READING" },
            item: { domain: "SPEAK", stableKey: "item-1", itemType: "READ_ALOUD" },
          },
        },
      ]);
    });
    const service = new AssessmentReviewService({
      enrollment: { findMany: enrollmentFindMany },
      assessmentItem: { findMany: assessmentItemFindMany },
      practiceDefinition: { findMany: vi.fn().mockResolvedValue([]) },
    } as never, {} as never);

    const result = await service.listQueue(teacherAuth(), SCHOOL_ID);

    expect(assessmentItemQueries[0]?.where.session.classId).toEqual({ in: ["class-1"] });
    expect(result).toMatchObject({
      total: 1,
      items: [{
        itemId: "item-1",
        sessionId: "session-1",
        submissionId: "submission-1",
        assignmentId: "assignment-1",
        student: { displayName: "测试学生" },
      }],
    });
  });
});
