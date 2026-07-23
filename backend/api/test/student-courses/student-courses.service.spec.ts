import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";
import { StudentCoursesService } from "../../src/modules/student-courses/student-courses.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "99999999-9999-4999-8999-999999999999";
const studentId = "22222222-2222-4222-8222-222222222222";
const enrollmentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function auth(userId = studentId, tenantSchoolId = schoolId): AuthContext {
  return {
    requestId: "course-test",
    tenant: { schoolId: tenantSchoolId },
    principal: { userId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
  };
}

describe("StudentCoursesService security and completion", () => {
  it("rejects a cross-school catalog read before querying enrollment", async () => {
    const prisma = { enrollment: { findFirst: vi.fn() } };
    const service = new StudentCoursesService(prisma as any);
    await expect(service.list(auth(), otherSchoolId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a different student without an active scoped enrollment", async () => {
    const prisma = { enrollment: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new StudentCoursesService(prisma as any);
    await expect(service.list(auth("33333333-3333-4333-8333-333333333333"), schoolId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps the catalog cursor out of the Prisma where filter", async () => {
    const prisma = {
      enrollment: { findFirst: vi.fn().mockResolvedValue({ id: enrollmentId, classId: null }) },
      assignment: {
        findFirst: vi.fn().mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      courseVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new StudentCoursesService(prisma as any);

    await service.list(auth(), schoolId, { cursor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", limit: 20 });

    expect(prisma.assignment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      skip: 1,
    }));
    expect(prisma.assignment.count.mock.calls[0]?.[0].where).not.toHaveProperty("cursor");
  });

  it("keeps attainment PENDING when learning is 100 percent but speech is processing", () => {
    const service = new StudentCoursesService({} as any);
    const result = (service as any).attainment([{ status: "PROCESSING", result: null, errorCode: null }], 100);
    expect(result).toBe("PENDING");
  });

  it("reports provider unavailability without reducing learning completion", () => {
    const service = new StudentCoursesService({} as any);
    const result = (service as any).attainment([{ status: "FAILED", result: null, errorCode: "PROVIDER_UNAVAILABLE" }], 100);
    expect(result).toBe("PROVIDER_UNAVAILABLE");
  });

  it("does not expose unpublished course points", () => {
    const service = new StudentCoursesService({} as any);
    expect((service as any).publishedStudentNotes({ published: false, items: ["private"] })).toBeNull();
    expect((service as any).publishedStudentNotes({ published: true, items: ["public"] })).toMatchObject({ items: ["public"] });
  });

  it("returns the nested course aggregate with submission revision and practice reference", async () => {
    const now = new Date("2026-07-23T00:00:00.000Z");
    const assignmentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const activityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const submissionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const definitionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const assignment = {
      id: assignmentId,
      title: "古诗文训练",
      source: "TEACHER_ASSIGNED",
      startsAt: now,
      dueAt: null,
      completionRule: {},
      courseVersionId: "12121212-1212-4212-8212-121212121212",
      courseVersion: {
        id: "12121212-1212-4212-8212-121212121212",
        version: 1,
        status: "PUBLISHED",
        title: "春晓朗读与理解",
        description: "课程说明",
        gradeBand: "五年级",
        objectives: ["准确朗读"],
        capabilityTheme: "朗读与理解",
        difficulty: "基础",
        estimatedMinutes: 20,
        coverAsset: "/cover.webp",
        deviceRequirements: null,
        course: { id: "13131313-1313-4313-8313-131313131313", stableKey: "spring", title: "古诗文" },
        units: [{
          id: "14141414-1414-4414-8414-141414141414",
          title: "第一单元",
          sortOrder: 1,
          lessons: [{
            id: "15151515-1515-4515-8515-151515151515",
            title: "春晓",
            sortOrder: 1,
            activities: [{
              id: activityId,
              type: "PRACTICE",
              title: "朗读与理解训练",
              instruction: "先朗读，再作答",
              content: { passage: "春眠不觉晓" },
              required: true,
              completionRule: {},
              studentNotes: { published: true, items: ["注意停顿"] },
              resources: [],
              progress: [{ completed: true, revision: 2, position: 1 }],
              attempts: [{ id: "16161616-1616-4616-8616-161616161616", kind: "COURSE_PRACTICE" }],
              coursePractice: {
                practiceDefinitionId: definitionId,
                required: true,
                practiceDefinition: { id: definitionId, title: "春晓综合练习" },
              },
            }],
          }],
        }],
      },
    };
    const submission = {
      id: submissionId,
      assignmentId,
      enrollmentId,
      attemptNo: 1,
      status: "IN_PROGRESS",
      revision: 4,
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const prisma = {
      enrollment: { findFirst: vi.fn().mockResolvedValue({ id: enrollmentId, classId: "17171717-1717-4717-8717-171717171717" }) },
      assignment: { findFirstOrThrow: vi.fn().mockResolvedValue(assignment) },
      submission: { findFirst: vi.fn().mockResolvedValue(submission) },
      learningActivity: { findMany: vi.fn().mockResolvedValue([{ id: activityId, coursePractice: { required: true } }]) },
      activityProgress: { findMany: vi.fn().mockResolvedValue([{ activityId }]) },
      assessmentSession: { findMany: vi.fn().mockResolvedValue([{ courseActivityId: activityId }]) },
      speechJob: { findMany: vi.fn().mockResolvedValue([]) },
      studentActivityNote: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await new StudentCoursesService(prisma as any).detail(auth(), schoolId, assignmentId);

    expect(result.assignment.id).toBe(assignmentId);
    expect(result.existingSubmission).toMatchObject({ id: submissionId, status: "IN_PROGRESS", revision: 4 });
    expect(result.units[0]?.lessons[0]?.activities[0]).toMatchObject({
      id: activityId,
      instruction: "先朗读，再作答",
      content: { passage: "春眠不觉晓" },
      progress: { completed: true, revision: 2 },
      attempt: { kind: "COURSE_PRACTICE" },
      practiceReference: { practiceDefinitionId: definitionId, required: true },
    });
    expect(result.practiceReferences).toEqual([{
      activityId,
      practiceDefinitionId: definitionId,
      title: "春晓综合练习",
      required: true,
    }]);
  });

  it("completes a submitted course practice idempotently on the same composite keys", async () => {
    const assignmentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const activityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const submissionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const definitionId = "18181818-1818-4818-8818-181818181818";
    const activity = {
      id: activityId,
      coursePractice: { practiceDefinitionId: definitionId, required: true },
    };
    const assignment = {
      id: assignmentId,
      courseVersionId: "19191919-1919-4919-8919-191919191919",
      courseVersion: { id: "19191919-1919-4919-8919-191919191919", units: [{ lessons: [{ activities: [activity] }] }] },
    };
    const activityAttempt = { upsert: vi.fn().mockResolvedValue({ id: "20202020-2020-4020-8020-202020202020" }) };
    const activityProgress = {
      upsert: vi.fn().mockResolvedValue({ id: "21212121-2121-4121-8121-212121212121", completed: true }),
      findMany: vi.fn().mockResolvedValue([{ activityId }]),
    };
    const prisma = {
      enrollment: { findFirst: vi.fn().mockResolvedValue({ id: enrollmentId, classId: "17171717-1717-4717-8717-171717171717" }) },
      assignment: { findFirstOrThrow: vi.fn().mockResolvedValue(assignment) },
      submission: { findFirst: vi.fn().mockResolvedValue({ id: submissionId }) },
      assessmentSession: {
        findFirst: vi.fn().mockResolvedValue({ id: attemptId, status: "SUBMITTED" }),
        findMany: vi.fn().mockResolvedValue([{ courseActivityId: activityId }]),
      },
      learningActivity: { findMany: vi.fn().mockResolvedValue([{ id: activityId, coursePractice: { required: true } }]) },
      activityProgress,
      speechJob: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((fn: (tx: any) => unknown) => fn({ activityAttempt, activityProgress })),
    };
    const service = new StudentCoursesService(prisma as any);

    await service.completePractice(auth(), schoolId, assignmentId, submissionId, activityId, attemptId);
    await service.completePractice(auth(), schoolId, assignmentId, submissionId, activityId, attemptId);

    expect(activityAttempt.upsert).toHaveBeenCalledTimes(2);
    expect(activityAttempt.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { submissionId_activityId: { submissionId, activityId } },
      update: { kind: "COURSE_PRACTICE", value: { practiceAttemptId: attemptId, status: "SUBMITTED" } },
    }));
    expect(activityProgress.upsert).toHaveBeenCalledTimes(2);
    expect(activityProgress.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { activityId_enrollmentId: { activityId, enrollmentId } },
      update: { position: 1, completed: true, revision: { increment: 1 } },
    }));
  });

  it("rejects completing a practice with another student's course submission", async () => {
    const assignmentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const prisma = {
      enrollment: { findFirst: vi.fn().mockResolvedValue({ id: enrollmentId, classId: "17171717-1717-4717-8717-171717171717" }) },
      assignment: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: assignmentId,
          courseVersion: { units: [{ lessons: [{ activities: [] }] }] },
        }),
      },
      submission: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await expect(new StudentCoursesService(prisma as any).completePractice(
      auth(),
      schoolId,
      assignmentId,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    )).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("saveActivityAttempt validation rules", () => {
  const assignmentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const activityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const submissionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  function makePrismaMock(overrides: { activityType?: string; submissionStatus?: string; coursePractice?: any } = {}) {
    const activity: any = { id: activityId, type: overrides.activityType ?? "TEXT" };
    if (overrides.coursePractice) activity.coursePractice = overrides.coursePractice;
    return {
      enrollment: { findFirst: vi.fn().mockResolvedValue({ id: enrollmentId, classId: "17171717-1717-4717-8717-171717171717" }) },
      assignment: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: assignmentId,
          schoolId,
          courseVersionId: "12121212-1212-4212-8212-121212121212",
          courseVersion: { id: "12121212-1212-4212-8212-121212121212", units: [{ lessons: [{ activities: [activity] }] }] },
        }),
      },
      submission: { findFirst: vi.fn().mockResolvedValue({ id: submissionId, enrollmentId, status: overrides.submissionStatus ?? "IN_PROGRESS" }) },
      activityProgress: { findUnique: vi.fn().mockResolvedValue(null) },
    };
  }

  function invoke(prisma: any, body: any) {
    const service = new StudentCoursesService(prisma as any);
    return service.saveActivityAttempt(auth(), schoolId, assignmentId, submissionId, activityId, body);
  }

  it("rejects when body.kind does not match activity.type", async () => {
    const prisma = makePrismaMock({ activityType: "TEXT" });
    await expect(invoke(prisma, { kind: "CHOICE", completed: false })).rejects.toMatchObject({
      message: "活动类型不匹配",
    });
    await expect(invoke(prisma, { kind: "CHOICE", completed: false })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects completing a SPEECH activity via generic save", async () => {
    const prisma = makePrismaMock({ activityType: "SPEECH" });
    await expect(invoke(prisma, { kind: "SPEECH", completed: true })).rejects.toMatchObject({
      message: "口语活动只能通过录音关联完成",
    });
    await expect(invoke(prisma, { kind: "SPEECH", completed: true })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects completing a PRACTICE activity via generic save", async () => {
    const prisma = makePrismaMock({ activityType: "PRACTICE" });
    await expect(invoke(prisma, { kind: "PRACTICE", completed: true })).rejects.toMatchObject({
      message: "课程练习只能通过练习完成接口完成",
    });
    await expect(invoke(prisma, { kind: "PRACTICE", completed: true })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects completing an activity with coursePractice via generic save", async () => {
    const prisma = makePrismaMock({ activityType: "TEXT", coursePractice: { practiceDefinitionId: "def-id", required: true } });
    await expect(invoke(prisma, { kind: "TEXT", completed: true, value: { acknowledged: true } })).rejects.toMatchObject({
      message: "课程练习只能通过练习完成接口完成",
    });
    await expect(invoke(prisma, { kind: "TEXT", completed: true, value: { acknowledged: true } })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects saving when submission status is already SUBMITTED", async () => {
    const prisma = makePrismaMock({ submissionStatus: "SUBMITTED" });
    await expect(invoke(prisma, { kind: "TEXT", completed: false })).rejects.toMatchObject({
      message: "课程已提交，不能修改活动进度",
    });
    await expect(invoke(prisma, { kind: "TEXT", completed: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects saving when submission status is PROCESSING", async () => {
    const prisma = makePrismaMock({ submissionStatus: "PROCESSING" });
    await expect(invoke(prisma, { kind: "TEXT", completed: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects saving when submission status is REVIEWED", async () => {
    const prisma = makePrismaMock({ submissionStatus: "REVIEWED" });
    await expect(invoke(prisma, { kind: "TEXT", completed: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects saving when submission status is ACCEPTED", async () => {
    const prisma = makePrismaMock({ submissionStatus: "ACCEPTED" });
    await expect(invoke(prisma, { kind: "TEXT", completed: false })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects completing TEXT activity without acknowledgement", async () => {
    const prisma = makePrismaMock({ activityType: "TEXT" });
    await expect(invoke(prisma, { kind: "TEXT", completed: true })).rejects.toMatchObject({
      message: "文本活动需要确认后才能标记完成",
    });
    await expect(invoke(prisma, { kind: "TEXT", completed: true })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects completing TEXT activity when acknowledged is not true", async () => {
    const prisma = makePrismaMock({ activityType: "TEXT" });
    await expect(invoke(prisma, { kind: "TEXT", completed: true, value: { acknowledged: false } })).rejects.toMatchObject({
      message: "文本活动需要确认后才能标记完成",
    });
  });

  it("rejects completing FILL_BLANK activity without value", async () => {
    const prisma = makePrismaMock({ activityType: "FILL_BLANK" });
    await expect(invoke(prisma, { kind: "FILL_BLANK", completed: true })).rejects.toMatchObject({
      message: "填空活动需要提供答案",
    });
    await expect(invoke(prisma, { kind: "FILL_BLANK", completed: true })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects completing FILL_BLANK activity with empty answers array", async () => {
    const prisma = makePrismaMock({ activityType: "FILL_BLANK" });
    await expect(invoke(prisma, { kind: "FILL_BLANK", completed: true, value: { answers: [] } })).rejects.toMatchObject({
      message: "填空活动答案不能为空",
    });
  });

  it("rejects completing FILL_BLANK activity with non-array answers", async () => {
    const prisma = makePrismaMock({ activityType: "FILL_BLANK" });
    await expect(invoke(prisma, { kind: "FILL_BLANK", completed: true, value: { answers: "not-array" } })).rejects.toMatchObject({
      message: "填空活动答案不能为空",
    });
  });

  it("rejects completing CHOICE activity without value", async () => {
    const prisma = makePrismaMock({ activityType: "CHOICE" });
    await expect(invoke(prisma, { kind: "CHOICE", completed: true })).rejects.toMatchObject({
      message: "选择活动需要提供答案",
    });
    await expect(invoke(prisma, { kind: "CHOICE", completed: true })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("rejects completing CHOICE activity with null answerIndex and null selectedIndex", async () => {
    const prisma = makePrismaMock({ activityType: "CHOICE" });
    await expect(invoke(prisma, { kind: "CHOICE", completed: true, value: { answerIndex: null, selectedIndex: null } })).rejects.toMatchObject({
      message: "选择活动答案索引无效",
    });
  });

  it("rejects completing CHOICE activity with negative answerIndex", async () => {
    const prisma = makePrismaMock({ activityType: "CHOICE" });
    await expect(invoke(prisma, { kind: "CHOICE", completed: true, value: { answerIndex: -1 } })).rejects.toMatchObject({
      message: "选择活动答案索引无效",
    });
  });

  it("rejects when expectedProgressRevision is 0 but progress already exists", async () => {
    const prisma = makePrismaMock({ activityType: "TEXT" });
    prisma.activityProgress.findUnique = vi.fn().mockResolvedValue({ id: "progress-id", activityId, enrollmentId, revision: 1 });
    await expect(invoke(prisma, { kind: "TEXT", completed: false, expectedProgressRevision: 0 })).rejects.toMatchObject({
      message: "学习进度已存在，请刷新后重试",
    });
    await expect(invoke(prisma, { kind: "TEXT", completed: false, expectedProgressRevision: 0 })).rejects.toBeInstanceOf(ConflictException);
  });
});
