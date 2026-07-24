import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PracticeService } from "../../src/modules/assessment/practice.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "99999999-9999-4999-8999-999999999999";
const studentId = "22222222-2222-4222-8222-222222222222";
const enrollment = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", classId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };

const auth: AuthContext = {
  requestId: "test", tenant: { schoolId },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
};

const delivery = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", practiceVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  practiceVersion: { sections: [{ sortOrder: 1, title: "跟读", items: [{ questionId: null, itemType: "LISTEN_REPEAT", sortOrder: 1, config: { targetText: "春风又绿江南岸" } }] }] },
};

function fakePrisma(overrides: Record<string, unknown> = {}) {
  const assessmentSession = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "CREATED" }) };
  const tx = {
    practiceDelivery: { findFirst: vi.fn().mockResolvedValue(delivery) },
    assessmentSession,
    assessmentItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    submission: { findFirst: vi.fn().mockResolvedValue({ id: "submission-1" }) },
    courseActivityPractice: { findFirst: vi.fn().mockResolvedValue({ activityId: "activity-1" }) },
  };
  return {
    enrollment: { findFirst: vi.fn().mockResolvedValue(enrollment) },
    practiceDelivery: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(delivery) },
    assessmentSession,
    assessmentItem: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    ...overrides,
    __tx: tx,
  };
}

describe("PracticeService", () => {
  it("atomically snapshots every published item into a new AssessmentSession", async () => {
    const prisma = fakePrisma();
    const service = new PracticeService(prisma as any);
    await expect(service.createOrResume(auth, schoolId, "f1111111-1111-4111-8111-111111111111")).resolves.toMatchObject({ attemptId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", resumed: false });
    expect(prisma.__tx.assessmentItem.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ itemType: "LISTEN_REPEAT", sectionTitle: "跟读", sortOrder: 1 })] }));
  });

  it("restores an unfinished attempt instead of copying a second snapshot", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.findFirst.mockResolvedValue({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "IN_PROGRESS" });
    const result = await new PracticeService(prisma as any).createOrResume(auth, schoolId, "f1111111-1111-4111-8111-111111111111");
    expect(result).toMatchObject({ resumed: true, attemptId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    expect(prisma.__tx.assessmentItem.createMany).not.toHaveBeenCalled();
  });

  it("rejects a published version with zero items", async () => {
    const prisma = fakePrisma();
    prisma.__tx.practiceDelivery.findFirst.mockResolvedValue({ ...delivery, practiceVersion: { sections: [] } });
    await expect(new PracticeService(prisma as any).createOrResume(auth, schoolId, "f1111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("fails closed before querying another school", async () => {
    const prisma = fakePrisma();
    await expect(new PracticeService(prisma as any).listForStudent(auth, otherSchoolId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
  });

  it("requires assignment, submission and activity IDs together", async () => {
    const prisma = fakePrisma();
    await expect(new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      { assignmentId: "assignment-1", activityId: "activity-1" },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.__tx.submission.findFirst).not.toHaveBeenCalled();
  });

  it("validates the scoped course context and persists both course foreign keys", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.create.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "CREATED",
      courseSubmissionId: "submission-1",
      courseActivityId: "activity-1",
    });
    const context = {
      assignmentId: "assignment-1",
      submissionId: "submission-1",
      activityId: "activity-1",
    };

    const result = await new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      context,
    );

    expect(result).toMatchObject({
      mode: "COURSE_PRACTICE",
      courseContext: { submissionId: "submission-1", activityId: "activity-1" },
    });
    expect(prisma.__tx.submission.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "submission-1",
        schoolId,
        assignmentId: "assignment-1",
        enrollmentId: enrollment.id,
      }),
      select: { id: true },
    });
    expect(prisma.__tx.courseActivityPractice.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        schoolId,
        activityId: "activity-1",
        practiceDefinitionId: "f1111111-1111-4111-8111-111111111111",
      }),
      select: { activityId: true },
    });
    expect(prisma.__tx.assessmentSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId,
        courseSubmissionId: "submission-1",
        courseActivityId: "activity-1",
      }),
    });
  });

  it("rejects another student's submission or an unrelated practice reference", async () => {
    const context = { assignmentId: "assignment-1", submissionId: "submission-1", activityId: "activity-1" };
    const wrongSubmission = fakePrisma();
    wrongSubmission.__tx.submission.findFirst.mockResolvedValue(null);
    await expect(new PracticeService(wrongSubmission as any).createOrResume(
      auth, schoolId, "f1111111-1111-4111-8111-111111111111", context,
    )).rejects.toBeInstanceOf(ForbiddenException);

    const wrongReference = fakePrisma();
    wrongReference.__tx.courseActivityPractice.findFirst.mockResolvedValue(null);
    await expect(new PracticeService(wrongReference as any).createOrResume(
      auth, schoolId, "f1111111-1111-4111-8111-111111111111", context,
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("resumes the same scoped course attempt without a duplicate snapshot", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.findFirst.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "IN_PROGRESS",
      courseSubmissionId: "submission-1",
      courseActivityId: "activity-1",
    });
    const result = await new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      { assignmentId: "assignment-1", submissionId: "submission-1", activityId: "activity-1" },
    );
    expect(result).toMatchObject({ resumed: true, mode: "COURSE_PRACTICE" });
    expect(prisma.__tx.assessmentSession.create).not.toHaveBeenCalled();
    expect(prisma.__tx.assessmentItem.createMany).not.toHaveBeenCalled();
  });
});

describe("PracticeService – independent practice (no course context)", () => {
  it("creates a SELF_PRACTICE attempt when no course context is provided", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.create.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "CREATED",
      courseSubmissionId: null,
      courseActivityId: null,
    });
    const result = await new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    expect(result).toMatchObject({ mode: "SELF_PRACTICE", courseContext: null, resumed: false });
    const createCall = prisma.__tx.assessmentSession.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data).not.toHaveProperty("courseSubmissionId");
    expect(createCall.data).not.toHaveProperty("courseActivityId");
  });

  it("resumes an existing independent attempt idempotently", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.findFirst.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "IN_PROGRESS",
      courseSubmissionId: null,
      courseActivityId: null,
    });
    const result = await new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    expect(result).toMatchObject({ resumed: true, mode: "SELF_PRACTICE", courseContext: null });
    expect(prisma.__tx.assessmentSession.create).not.toHaveBeenCalled();
    expect(prisma.__tx.assessmentItem.createMany).not.toHaveBeenCalled();
  });

  it("does not set courseSubmissionId or courseActivityId on independent attempt", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.create.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "CREATED",
    });
    await new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    const createCall = prisma.__tx.assessmentSession.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data).not.toHaveProperty("courseSubmissionId");
    expect(createCall.data).not.toHaveProperty("courseActivityId");
  });

  it("rejects a partial course context (only assignmentId) as invalid", async () => {
    const prisma = fakePrisma();
    await expect(new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      { assignmentId: "assignment-1" },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a partial course context (only submissionId and activityId) as invalid", async () => {
    const prisma = fakePrisma();
    await expect(new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      { submissionId: "submission-1", activityId: "activity-1" },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects cross-school access for independent practice", async () => {
    const prisma = fakePrisma();
    await expect(new PracticeService(prisma as any).createOrResume(
      auth,
      otherSchoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not call submission or courseActivity validators for independent practice", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.create.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "CREATED",
    });
    await new PracticeService(prisma as any).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    expect(prisma.__tx.submission.findFirst).not.toHaveBeenCalled();
    expect(prisma.__tx.courseActivityPractice.findFirst).not.toHaveBeenCalled();
  });
});
