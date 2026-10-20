import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AssessmentSession as DatabaseAssessmentSession, Prisma } from "@yuzan/database";
import { PracticeService } from "../../src/modules/assessment/practice.service.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "99999999-9999-4999-8999-999999999999";
const studentId = "22222222-2222-4222-8222-222222222222";
const enrollment = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", classId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
const standalonePracticeAttempt = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  schoolId,
  enrollmentId: enrollment.id,
  classId: enrollment.classId,
  initiatorUserId: studentId,
  type: "READING",
  purpose: "STANDARD",
  remediationOrigin: null,
  remediationFocus: null,
  status: "IN_PROGRESS",
  startedAt: new Date("2026-10-20T00:00:00.000Z"),
  submittedAt: null,
  completedAt: null,
  retestOfSessionId: null,
  practiceDefinitionId: "f1111111-1111-4111-8111-111111111111",
  practiceVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  deliveryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  courseActivityId: null,
  courseSubmissionId: null,
  revision: 1,
  createdAt: new Date("2026-10-20T00:00:00.000Z"),
  updatedAt: new Date("2026-10-20T00:00:00.000Z"),
} satisfies DatabaseAssessmentSession;
type PracticeEnrollment = typeof enrollment;
type PracticeAttempt = Pick<DatabaseAssessmentSession, "id" | "status" | "courseSubmissionId" | "courseActivityId">;
type PracticeSessionCreateData = Pick<
  Prisma.AssessmentSessionUncheckedCreateInput,
  "schoolId" | "enrollmentId" | "classId" | "initiatorUserId" | "type" |
  "practiceDefinitionId" | "practiceVersionId" | "deliveryId" | "courseActivityId" | "courseSubmissionId"
>;
type PracticeItemSnapshot = Prisma.AssessmentItemCreateManyInput;
type PracticeDelivery = {
  id: string;
  practiceVersionId: string;
  classId?: string;
  practiceVersion: {
    definitionId: string;
    sections: Array<{
      sortOrder: number;
      title: string;
      items: Array<{
        questionId: string | null;
        itemType: string;
        sortOrder: number;
        config: Prisma.InputJsonValue;
      }>;
    }>;
  };
};
type PracticeQueryArgs = { where: Record<string, unknown>; select?: Record<string, unknown> };

const auth: AuthContext = {
  requestId: "test", tenant: { schoolId },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
};

const delivery: PracticeDelivery = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", practiceVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  practiceVersion: { definitionId: "f1111111-1111-4111-8111-111111111111", sections: [{ sortOrder: 1, title: "跟读", items: [{ questionId: null, itemType: "LISTEN_REPEAT", sortOrder: 1, config: { targetText: "春风又绿江南岸" } }] }] },
};

function fakePrisma() {
  const assessmentSession = {
    findFirst: vi.fn<(args: PracticeQueryArgs) => Promise<PracticeAttempt | null>>().mockResolvedValue(null),
    create: vi.fn<(args: { data: PracticeSessionCreateData }) => Promise<PracticeAttempt>>().mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "CREATED",
      courseSubmissionId: null,
      courseActivityId: null,
    }),
  };
  const practiceDelivery = {
    findFirst: vi.fn<(args: PracticeQueryArgs) => Promise<PracticeDelivery | null>>().mockResolvedValue(delivery),
  };
  const submission = {
    findFirst: vi.fn<(args: PracticeQueryArgs) => Promise<{ id: string; enrollmentId: string } | null>>().mockResolvedValue({
      id: "submission-1",
      enrollmentId: enrollment.id,
    }),
  };
  const courseActivityPractice = {
    findFirst: vi.fn<(args: PracticeQueryArgs) => Promise<{ activityId: string } | null>>().mockResolvedValue({ activityId: "activity-1" }),
  };
  const assessmentItem = {
    createMany: vi.fn((args: { data: PracticeItemSnapshot[] }) => Promise.resolve({ count: args.data.length })),
  };
  const tx = {
    practiceDelivery,
    assessmentSession,
    assessmentItem,
    submission,
    courseActivityPractice,
  };
  return {
    enrollment: {
      findFirst: vi.fn<(args: PracticeQueryArgs) => Promise<PracticeEnrollment | null>>().mockResolvedValue(enrollment),
      findMany: vi.fn<(args: PracticeQueryArgs) => Promise<PracticeEnrollment[]>>().mockResolvedValue([enrollment]),
    },
    practiceDelivery: {
      findMany: vi.fn<(args: PracticeQueryArgs) => Promise<PracticeDelivery[]>>().mockResolvedValue([]),
      findFirst: practiceDelivery.findFirst,
    },
    assessmentSession,
    assessmentItem: { findMany: vi.fn<(args: PracticeQueryArgs) => Promise<unknown[]>>().mockResolvedValue([]) },
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    __tx: tx,
  };
}

function createPracticeService(prisma: ReturnType<typeof fakePrisma>): PracticeService {
  return new PracticeService(prisma as unknown as PrismaService);
}

describe("PracticeService", () => {
  it("returns standalone Attempt identity and explicit null course scope", async () => {
    const prisma = fakePrisma();
    prisma.assessmentSession.findFirst.mockResolvedValue(standalonePracticeAttempt);

    const result = await createPracticeService(prisma).getAttempt(auth, schoolId, standalonePracticeAttempt.id);

    expect(result).toEqual(standalonePracticeAttempt);
    expect(prisma.assessmentSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: standalonePracticeAttempt.id,
        schoolId,
        enrollment: { userId: studentId, role: "STUDENT", status: "ACTIVE" },
      },
    });
    expect(result.courseSubmissionId).toBeNull();
    expect(result.courseActivityId).toBeNull();
  });

  it("returns both persisted course scope IDs for a course-linked Attempt", async () => {
    const prisma = fakePrisma();
    const linkedAttempt: DatabaseAssessmentSession = {
      ...standalonePracticeAttempt,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccd",
      courseActivityId: "11111111-2222-4333-8444-555555555555",
      courseSubmissionId: "66666666-7777-4888-8999-aaaaaaaaaaaa",
    };
    prisma.assessmentSession.findFirst.mockResolvedValue(linkedAttempt);

    const result = await createPracticeService(prisma).getAttempt(auth, schoolId, linkedAttempt.id);

    expect(result).toMatchObject({
      schoolId,
      enrollmentId: enrollment.id,
      initiatorUserId: studentId,
      practiceDefinitionId: standalonePracticeAttempt.practiceDefinitionId,
      courseActivityId: linkedAttempt.courseActivityId,
      courseSubmissionId: linkedAttempt.courseSubmissionId,
    });
  });

  it("denies a cross-school Attempt lookup before querying", async () => {
    const prisma = fakePrisma();

    await expect(createPracticeService(prisma).getAttempt(auth, otherSchoolId, standalonePracticeAttempt.id))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentSession.findFirst).not.toHaveBeenCalled();
  });

  it("hides another student's Attempt in the same school as not found", async () => {
    const prisma = fakePrisma();
    prisma.assessmentSession.findFirst.mockResolvedValue(null);

    await expect(createPracticeService(prisma).getAttempt(auth, schoolId, standalonePracticeAttempt.id))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assessmentSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: standalonePracticeAttempt.id,
        schoolId,
        enrollment: { userId: studentId, role: "STUDENT", status: "ACTIVE" },
      },
    });
  });

  it("hides a same-student row without a practice definition as not found", async () => {
    const prisma = fakePrisma();
    const nonPracticeSession: DatabaseAssessmentSession = {
      ...standalonePracticeAttempt,
      practiceDefinitionId: null,
    };
    prisma.assessmentSession.findFirst.mockResolvedValue(nonPracticeSession);

    await expect(createPracticeService(prisma).getAttempt(auth, schoolId, standalonePracticeAttempt.id))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("atomically snapshots every published item into a new AssessmentSession", async () => {
    const prisma = fakePrisma();
    const service = createPracticeService(prisma);
    await expect(service.createOrResume(auth, schoolId, "f1111111-1111-4111-8111-111111111111")).resolves.toMatchObject({ attemptId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", resumed: false });
    expect(prisma.__tx.assessmentItem.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ itemType: "LISTEN_REPEAT", sectionTitle: "跟读", sortOrder: 1 })] }));
  });

  it("restores an unfinished attempt instead of copying a second snapshot", async () => {
    const prisma = fakePrisma();
    prisma.__tx.assessmentSession.findFirst.mockResolvedValue({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "IN_PROGRESS", courseSubmissionId: null, courseActivityId: null });
    const result = await createPracticeService(prisma).createOrResume(auth, schoolId, "f1111111-1111-4111-8111-111111111111");
    expect(result).toMatchObject({ resumed: true, attemptId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    expect(prisma.__tx.assessmentItem.createMany).not.toHaveBeenCalled();
  });

  it("rejects a published version with zero items", async () => {
    const prisma = fakePrisma();
    prisma.__tx.practiceDelivery.findFirst.mockResolvedValue({ ...delivery, practiceVersion: { ...delivery.practiceVersion, sections: [] } });
    await expect(createPracticeService(prisma).createOrResume(auth, schoolId, "f1111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("fails closed before querying another school", async () => {
    const prisma = fakePrisma();
    await expect(createPracticeService(prisma).listForStudent(auth, otherSchoolId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
  });

  it("requires assignment, submission and activity IDs together", async () => {
    const prisma = fakePrisma();
    await expect(createPracticeService(prisma).createOrResume(
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

    const result = await createPracticeService(prisma).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      context,
    );

    expect(result).toMatchObject({
      mode: "COURSE_PRACTICE",
      courseContext: { submissionId: "submission-1", activityId: "activity-1" },
    });
    const submissionLookup = prisma.__tx.submission.findFirst.mock.calls[0]?.[0];
    expect(submissionLookup?.where.id).toBe("submission-1");
    expect(submissionLookup?.where.schoolId).toBe(schoolId);
    expect(submissionLookup?.where.assignmentId).toBe("assignment-1");
    expect(submissionLookup?.where.enrollmentId).toEqual({ in: [enrollment.id] });
    expect(submissionLookup?.select).toEqual({ enrollmentId: true });
    const practiceReferenceLookup = prisma.__tx.courseActivityPractice.findFirst.mock.calls[0]?.[0];
    expect(practiceReferenceLookup?.where.schoolId).toBe(schoolId);
    expect(practiceReferenceLookup?.where.activityId).toBe("activity-1");
    expect(practiceReferenceLookup?.where.practiceDefinitionId).toBe("f1111111-1111-4111-8111-111111111111");
    expect(practiceReferenceLookup?.select).toEqual({ activityId: true });
    const sessionCreate = prisma.__tx.assessmentSession.create.mock.calls[0]?.[0];
    expect(sessionCreate?.data.schoolId).toBe(schoolId);
    expect(sessionCreate?.data.courseSubmissionId).toBe("submission-1");
    expect(sessionCreate?.data.courseActivityId).toBe("activity-1");
  });

  it("rejects another student's submission or an unrelated practice reference", async () => {
    const context = { assignmentId: "assignment-1", submissionId: "submission-1", activityId: "activity-1" };
    const wrongSubmission = fakePrisma();
    wrongSubmission.__tx.submission.findFirst.mockResolvedValue(null);
    await expect(createPracticeService(wrongSubmission).createOrResume(
      auth, schoolId, "f1111111-1111-4111-8111-111111111111", context,
    )).rejects.toBeInstanceOf(ForbiddenException);

    const wrongReference = fakePrisma();
    wrongReference.__tx.courseActivityPractice.findFirst.mockResolvedValue(null);
    await expect(createPracticeService(wrongReference).createOrResume(
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
    const result = await createPracticeService(prisma).createOrResume(
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
    const result = await createPracticeService(prisma).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    expect(result).toMatchObject({ mode: "SELF_PRACTICE", courseContext: null, resumed: false });
    const createCall = prisma.__tx.assessmentSession.create.mock.calls[0]?.[0];
    if (!createCall) throw new Error("assessment session create was not called");
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
    const result = await createPracticeService(prisma).createOrResume(
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
      courseSubmissionId: null,
      courseActivityId: null,
    });
    await createPracticeService(prisma).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    const createCall = prisma.__tx.assessmentSession.create.mock.calls[0]?.[0];
    if (!createCall) throw new Error("assessment session create was not called");
    expect(createCall.data).not.toHaveProperty("courseSubmissionId");
    expect(createCall.data).not.toHaveProperty("courseActivityId");
  });

  it("rejects a partial course context (only assignmentId) as invalid", async () => {
    const prisma = fakePrisma();
    await expect(createPracticeService(prisma).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      { assignmentId: "assignment-1" },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a partial course context (only submissionId and activityId) as invalid", async () => {
    const prisma = fakePrisma();
    await expect(createPracticeService(prisma).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      { submissionId: "submission-1", activityId: "activity-1" },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects cross-school access for independent practice", async () => {
    const prisma = fakePrisma();
    await expect(createPracticeService(prisma).createOrResume(
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
      courseSubmissionId: null,
      courseActivityId: null,
    });
    await createPracticeService(prisma).createOrResume(
      auth,
      schoolId,
      "f1111111-1111-4111-8111-111111111111",
      {},
    );
    expect(prisma.__tx.submission.findFirst).not.toHaveBeenCalled();
    expect(prisma.__tx.courseActivityPractice.findFirst).not.toHaveBeenCalled();
  });
});

describe("Today multi-enrollment practice creation", () => {
  const second = { id: "abababab-abab-4bab-8bab-abababababab", classId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd" };
  const definitionId = "f1111111-1111-4111-8111-111111111111";

  it("creates in the later authorized delivery class and resumes that same attempt", async () => {
    const prisma = fakePrisma();
    prisma.enrollment.findMany.mockResolvedValue([enrollment, second]);
    prisma.__tx.practiceDelivery.findFirst.mockResolvedValue({ ...delivery, classId: second.classId });
    const service = createPracticeService(prisma);
    await service.createOrResume(auth, schoolId, definitionId);
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId, userId: studentId, role: "STUDENT", status: "ACTIVE" },
    }));
    expect(prisma.__tx.practiceDelivery.findFirst.mock.calls[0]?.[0].where.OR).toEqual([
      { studentId }, { studentId: null, classId: { in: [enrollment.classId, second.classId] } },
    ]);
    const createdSession = prisma.__tx.assessmentSession.create.mock.calls[0]?.[0];
    expect(createdSession?.data.enrollmentId).toBe(second.id);
    expect(createdSession?.data.classId).toBe(second.classId);
    prisma.__tx.assessmentSession.findFirst.mockResolvedValue({ id: "same-attempt", status: "IN_PROGRESS", courseSubmissionId: null, courseActivityId: null });
    expect(await service.createOrResume(auth, schoolId, definitionId)).toMatchObject({ attemptId: "same-attempt", resumed: true });
    expect(prisma.__tx.assessmentSession.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a student with no active enrollment without reading deliveries", async () => {
    const prisma = fakePrisma();
    prisma.enrollment.findMany.mockResolvedValue([]);
    await expect(createPracticeService(prisma).createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.__tx.practiceDelivery.findFirst).not.toHaveBeenCalled();
  });

  it("does not create an attempt when no authorized delivery exists", async () => {
    const prisma = fakePrisma();
    prisma.__tx.practiceDelivery.findFirst.mockResolvedValue(null);
    await expect(createPracticeService(prisma).createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.__tx.assessmentSession.create).not.toHaveBeenCalled();
  });

  it("binds a course attempt to its own active submission enrollment", async () => {
    const prisma = fakePrisma();
    prisma.enrollment.findMany.mockResolvedValue([enrollment, second]);
    prisma.__tx.submission.findFirst.mockResolvedValue({ id: "submission-2", enrollmentId: second.id });
    await createPracticeService(prisma).createOrResume(auth, schoolId, definitionId, {
      assignmentId: "assignment-2", submissionId: "submission-2", activityId: "activity-2",
    });
    expect(prisma.__tx.practiceDelivery.findFirst.mock.calls[0]?.[0].where.OR).toContainEqual({ studentId: null, classId: { in: [second.classId] } });
    const createdSession = prisma.__tx.assessmentSession.create.mock.calls[0]?.[0];
    expect(createdSession?.data.enrollmentId).toBe(second.id);
    expect(createdSession?.data.classId).toBe(second.classId);
    expect(createdSession?.data.courseSubmissionId).toBe("submission-2");
  });

  it("denies a foreign submission before preparing a course attempt", async () => {
    const prisma = fakePrisma();
    prisma.__tx.submission.findFirst.mockResolvedValue(null);
    await expect(createPracticeService(prisma).createOrResume(auth, schoolId, definitionId, {
      assignmentId: "foreign-assignment", submissionId: "foreign-submission", activityId: "foreign-activity",
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.__tx.assessmentSession.create).not.toHaveBeenCalled();
  });
});
