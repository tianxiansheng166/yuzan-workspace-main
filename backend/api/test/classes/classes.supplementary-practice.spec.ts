import { describe, expect, it, vi } from "vitest";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import { ClassesService } from "../../src/modules/classes/classes.service.js";
import {
  ClassConflictException,
  ClassForbiddenException,
  ClassInvalidInputException,
  ClassNotFoundException,
} from "../../src/modules/classes/domain/class.errors.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const teacherId = "33333333-3333-4333-8333-333333333333";
const courseVersionId = "44444444-4444-4444-8444-444444444444";
const studentA = "55555555-5555-4555-8555-555555555555";
const studentB = "66666666-6666-4666-8666-666666666666";
const studentC = "77777777-7777-4777-8777-777777777777";
const foreignStudent = "88888888-8888-4888-8888-888888888888";
const assignmentId = "99999999-9999-4999-8999-999999999999";

const validEnrollments = [studentA, studentB, studentC].map((id) => ({
  id,
  schoolId,
  classId,
  role: "STUDENT",
  status: "ACTIVE",
}));

function makeAuth(overrides: { userId?: string; schoolId?: string; roles?: MembershipRole[] } = {}) {
  return createAuthContext(
    "test-request",
    {
      userId: overrides.userId ?? teacherId,
      roles: overrides.roles ?? [MembershipRole.TEACHER],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "session",
    },
    { schoolId: overrides.schoolId ?? schoolId },
  );
}

function setup(options: {
  authorized?: boolean;
  classExists?: boolean;
  courseVersion?: { id: string; status: string; publishedAt: Date | null; retiredAt: Date | null } | null;
  existingCourseAssignment?: { courseVersionId: string } | null;
  enrollments?: typeof validEnrollments;
  existingAudit?: { resourceId: string; afterSummary: { requestHash?: string } } | null;
  existingAssignment?: any;
} = {}) {
  const classItem = {
    id: classId,
    schoolId,
    termId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "TEST_FIXTURE_ONLY 班级",
    grade: "七年级",
    teacherUserIds: options.authorized === false ? [] : [teacherId],
    studentCount: 3,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const classRepo = {
    findById: vi.fn().mockResolvedValue(options.classExists === false ? null : classItem),
  };
  const assignmentCreate = vi.fn(async ({ data }: any) => ({
    id: assignmentId,
    schoolId,
    courseVersionId: data.courseVersionId,
    title: data.title,
    status: "OPEN",
    startsAt: data.startsAt,
    dueAt: data.dueAt,
  }));
  const assignmentTargetCreate = vi.fn(async ({ data }: any) => ({
    id: `target-${data.targetType}-${data.enrollmentId ?? "class"}`,
    targetType: data.targetType,
    classId: data.classId ?? null,
    enrollmentId: data.enrollmentId ?? null,
  }));
  const auditCreate = vi.fn(async ({ data }: any) => data);
  const auditFindFirst = vi.fn().mockResolvedValue(options.existingAudit ?? null);
  const assignmentFindFirst = vi.fn().mockResolvedValue(options.existingAssignment ?? null);
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    assignment: { create: assignmentCreate, findFirst: assignmentFindFirst },
    assignmentTarget: { create: assignmentTargetCreate },
    auditLog: { findFirst: auditFindFirst, create: auditCreate },
  };
  const prisma: any = {
    $transaction: vi.fn(async (callback: (transaction: any) => unknown) => callback(tx)),
    enrollment: {
      findMany: vi.fn(async ({ where }: any) => {
        const requested = where.id?.in as string[] | undefined;
        return (options.enrollments ?? validEnrollments).filter(
          (enrollment) =>
            requested?.includes(enrollment.id) &&
            enrollment.schoolId === where.schoolId &&
            enrollment.classId === where.classId &&
            enrollment.role === where.role &&
            enrollment.status === where.status,
        );
      }),
      count: vi.fn().mockResolvedValue(3),
    },
    courseVersion: {
      findFirst: vi.fn().mockResolvedValue(
        options.courseVersion === undefined
          ? {
              id: courseVersionId,
              status: "PUBLISHED",
              publishedAt: new Date("2026-01-01T00:00:00.000Z"),
              retiredAt: null,
            }
          : options.courseVersion,
      ),
    },
    assignment: {
      findFirst: vi.fn().mockResolvedValue(options.existingCourseAssignment ?? null),
    },
  };
  const service = new ClassesService(classRepo as any, prisma, {} as any);
  return { service, classRepo, prisma, tx, assignmentCreate, assignmentTargetCreate, auditCreate, auditFindFirst, assignmentFindFirst };
}

const request = (targetEnrollmentIds?: string[]) => ({
  title: "定向巩固",
  courseVersionId,
  dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  ...(targetEnrollmentIds === undefined ? {} : { targetEnrollmentIds }),
});

describe("ClassesService.createSupplementaryPractice", () => {
  it("creates one OPEN Assignment with exactly the selected STUDENT targets and a real audit row", async () => {
    const { service, assignmentCreate, assignmentTargetCreate, auditCreate } = setup();
    const result = await service.createSupplementaryPractice(
      makeAuth(), schoolId, classId, request([studentA, studentB]), "t014-selection-1",
    );

    expect(result).toMatchObject({ id: assignmentId, status: "OPEN", targetCount: 2 });
    expect(result.targets).toHaveLength(2);
    expect(result.targets.map((target) => target.enrollmentId)).toEqual([studentA, studentB]);
    expect(result.targets.every((target) => target.targetType === "STUDENT" && target.classId === null)).toBe(true);
    expect(assignmentCreate).toHaveBeenCalledOnce();
    expect(assignmentTargetCreate).toHaveBeenCalledTimes(2);
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(auditCreate.mock.calls[0]?.[0].data).toMatchObject({
      action: "SUPPLEMENTARY_PRACTICE_CREATED",
      resourceType: "Assignment",
      resourceId: assignmentId,
      requestId: "t014-selection-1",
      afterSummary: { classId, targetEnrollmentIds: [studentA, studentB] },
    });
  });

  it("creates a class-wide Assignment only when targets are omitted", async () => {
    const { service, assignmentTargetCreate } = setup();
    const result = await service.createSupplementaryPractice(makeAuth(), schoolId, classId, request());
    expect(result.targetCount).toBe(3);
    expect(result.targets).toEqual([
      { id: "target-CLASS-class", targetType: "CLASS", classId, enrollmentId: null },
    ]);
    expect(assignmentTargetCreate).toHaveBeenCalledOnce();
  });

  it("rejects a teacher who is not assigned to the class", async () => {
    const { service, prisma, assignmentCreate } = setup({ authorized: false });
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request([studentA])))
      .rejects.toBeInstanceOf(ClassForbiddenException);
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it("rejects a mismatched school before reading or writing class data", async () => {
    const { service, classRepo, assignmentCreate } = setup();
    await expect(service.createSupplementaryPractice(makeAuth({ schoolId: foreignStudent }), schoolId, classId, request()))
      .rejects.toBeInstanceOf(ClassForbiddenException);
    expect(classRepo.findById).not.toHaveBeenCalled();
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it("returns 404 for a nonexistent class", async () => {
    const { service } = setup({ classExists: false });
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request()))
      .rejects.toBeInstanceOf(ClassNotFoundException);
  });

  it("returns 409 when neither the request nor class has a published course version", async () => {
    const { service, prisma } = setup({ existingCourseAssignment: null });
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, {
      title: "缺课程",
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })).rejects.toBeInstanceOf(ClassConflictException);
    expect(prisma.courseVersion.findFirst).not.toHaveBeenCalled();
  });

  it("returns 409 for a draft or retired course version", async () => {
    const { service } = setup({
      courseVersion: { id: courseVersionId, status: "DRAFT", publishedAt: null, retiredAt: null },
    });
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request([studentA])))
      .rejects.toBeInstanceOf(ClassConflictException);
  });

  it.each([
    ["another class", foreignStudent],
    ["another school", foreignStudent],
  ])("rejects a target from %s", async (_label, enrollmentId) => {
    const { service, assignmentCreate } = setup();
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request([enrollmentId])))
      .rejects.toBeInstanceOf(ClassInvalidInputException);
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it("rejects an inactive or non-STUDENT enrollment", async () => {
    const invalidEnrollment = {
      ...validEnrollments[0]!,
      status: "SUSPENDED",
      role: "TEACHER",
    };
    const { service, assignmentCreate } = setup({ enrollments: [invalidEnrollment] });
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request([studentA])))
      .rejects.toBeInstanceOf(ClassInvalidInputException);
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it("rejects empty targets, duplicate targets, and an invalid deadline", async () => {
    const { service } = setup();
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request([])))
      .rejects.toBeInstanceOf(ClassInvalidInputException);
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, request([studentA, studentA])))
      .rejects.toBeInstanceOf(ClassConflictException);
    await expect(service.createSupplementaryPractice(makeAuth(), schoolId, classId, {
      ...request([studentA]),
      dueAt: new Date(Date.now() - 1000).toISOString(),
    })).rejects.toBeInstanceOf(ClassInvalidInputException);
  });

  it("reuses the existing Assignment for an identical idempotent request", async () => {
    const { service, assignmentCreate, auditCreate, assignmentFindFirst } = setup();
    const body = request([studentA]);
    const key = "t014-replay-1";
    await service.createSupplementaryPractice(makeAuth(), schoolId, classId, body, key);
    const audit = auditCreate.mock.calls[0]?.[0].data;
    const existing = {
      id: assignmentId,
      schoolId,
      courseVersionId,
      title: "【补充练习】定向巩固",
      status: "OPEN",
      startsAt: new Date(),
      dueAt: new Date(body.dueAt),
      targets: [{ id: "target-a", targetType: "STUDENT", classId: null, enrollmentId: studentA }],
    };
    const replay = setup({
      existingAudit: { resourceId: assignmentId, afterSummary: audit.afterSummary },
      existingAssignment: existing,
    });
    const replayResult = await replay.service.createSupplementaryPractice(makeAuth(), schoolId, classId, body, key);
    expect(replayResult.id).toBe(assignmentId);
    expect(replay.assignmentFindFirst).toHaveBeenCalledOnce();
    expect(replay.assignmentCreate).not.toHaveBeenCalled();
    expect(assignmentCreate).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("returns 409 when an idempotency key is replayed with a different request body", async () => {
    const { service, auditCreate } = setup();
    const key = "t014-conflict-1";
    const first = request([studentA]);
    await service.createSupplementaryPractice(makeAuth(), schoolId, classId, first, key);
    const afterSummary = auditCreate.mock.calls[0]?.[0].data.afterSummary;
    const replay = setup({ existingAudit: { resourceId: assignmentId, afterSummary } });
    await expect(replay.service.createSupplementaryPractice(
      makeAuth(), schoolId, classId, request([studentB]), key,
    )).rejects.toBeInstanceOf(ClassConflictException);
  });
});
