import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import {
  MembershipStatus,
  type AuthContext,
} from "../../src/common/security/auth.types.js";
import { StudentDashboardService } from "../../src/modules/student-dashboard/student-dashboard.service.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SCHOOL_ID = "99999999-9999-4999-8999-999999999999";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const ENROLLMENT_ID = "33333333-3333-4333-8333-333333333333";
const CLASS_ID = "44444444-4444-4444-8444-444444444444";
const ENROLLMENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENROLLMENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLASS_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CLASS_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function auth(schoolId = SCHOOL_ID): AuthContext {
  return {
    requestId: "today-service-test",
    tenant: { schoolId },
    principal: {
      userId: STUDENT_ID,
      roles: [MembershipRole.STUDENT],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "session",
    },
  };
}

function prismaForToday(
  overrides: Record<string, unknown> = {},
  enrollments = [{ id: ENROLLMENT_ID, classId: CLASS_ID }],
) {
  return {
    enrollment: { findMany: vi.fn().mockResolvedValue(enrollments) },
    assessmentSession: { findMany: vi.fn().mockResolvedValue([]) },
    assignment: { findMany: vi.fn().mockResolvedValue([]) },
    practiceDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    practiceDefinition: { findMany: vi.fn().mockResolvedValue([]) },
    activityProgress: { count: vi.fn().mockResolvedValue(0) },
    offlineContentPackage: { count: vi.fn().mockResolvedValue(0) },
    ...overrides,
  };
}

function diagnosisSummary() {
  return {
    diagnosis: {
      version: "qb-diagnosis-v1",
      overall: { earnedPoints: 80, maxPoints: 100, percentage: 80 },
      domains: [],
      families: [],
      strengths: [],
      priorities: [],
      retryCandidates: [],
      nextSteps: [],
    },
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    enrollmentId: ENROLLMENT_A,
    purpose: "STANDARD",
    remediationOrigin: null,
    remediationFocus: null,
    status: "COMPLETED",
    createdAt: new Date("2026-08-20T01:00:00.000Z"),
    updatedAt: new Date("2026-08-20T01:05:00.000Z"),
    completedAt: new Date("2026-08-20T01:00:00.000Z"),
    practiceDefinitionId: "level-one",
    report: { overallScore: 80, summary: diagnosisSummary() },
    items: [],
    ...overrides,
  };
}

describe("StudentDashboardService Student Today", () => {
  it("fails closed before reading student data for another school", async () => {
    const prisma = prismaForToday();
    const service = new StudentDashboardService(prisma as any, {} as any);
    await expect(
      service.getTodayTasks(auth(), OTHER_SCHOOL_ID),
    ).rejects.toThrow();
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("derives a teacher-assigned action from the current enrollment only", async () => {
    const prisma = prismaForToday({
      assessmentSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "55555555-5555-4555-8555-555555555555",
            purpose: "REMEDIATION",
            remediationOrigin: "TEACHER_ASSIGNED",
            remediationFocus: { mode: "FAMILY", family: "READ_ALOUD" },
            status: "CREATED",
            createdAt: new Date("2026-08-24T01:00:00.000Z"),
            updatedAt: new Date("2026-08-24T01:05:00.000Z"),
            completedAt: null,
            practiceDefinitionId: null,
            report: null,
            items: [{ id: "item-1" }, { id: "item-2" }],
          },
        ]),
      },
    });
    const service = new StudentDashboardService(prisma as any, {} as any);
    const result = await service.getTodayTasks(auth(), SCHOOL_ID);
    expect(result).toMatchObject({
      version: "student-today-v1",
      primaryAction: {
        kind: "TEACHER_REMEDIATION",
        reason: "老师给你布置了 2 道「朗读句子」巩固题。",
      },
    });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: STUDENT_ID,
          schoolId: SCHOOL_ID,
        }),
      }),
    );
    expect(prisma.assessmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: SCHOOL_ID,
          enrollmentId: { in: [ENROLLMENT_ID] },
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /correctAnswer|referenceAnswer|acceptedAnswers|scoringSpec|rubric|deductionRules|sourceTrace|providerAudit|rawResponse|transcript|candidatePoints/,
    );
  });

  it("includes teacher remediation from a non-first active enrollment", async () => {
    const prisma = prismaForToday(
      {
        assessmentSession: {
          findMany: vi.fn().mockResolvedValue([
            session({
              id: "teacher-class-b",
              enrollmentId: ENROLLMENT_B,
              purpose: "REMEDIATION",
              remediationOrigin: "TEACHER_ASSIGNED",
              remediationFocus: {
                mode: "FAMILY",
                family: "PICTURE_SPEAKING",
              },
              status: "CREATED",
              createdAt: new Date("2026-08-24T02:00:00.000Z"),
              updatedAt: new Date("2026-08-24T02:05:00.000Z"),
              completedAt: null,
              practiceDefinitionId: null,
              report: null,
              items: [{ id: "item-1" }, { id: "item-2" }],
            }),
          ]),
        },
      },
      [
        { id: ENROLLMENT_A, classId: CLASS_A },
        { id: ENROLLMENT_B, classId: CLASS_B },
      ],
    );
    const service = new StudentDashboardService(prisma as any, {} as any);

    const result = await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(result.primaryAction).toMatchObject({
      kind: "TEACHER_REMEDIATION",
      title: "老师布置的看图说话专项巩固",
    });
    expect(prisma.assessmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollmentId: { in: [ENROLLMENT_A, ENROLLMENT_B] },
        }),
      }),
    );
  });

  it("is deep-equal when active enrollment insertion order is reversed", async () => {
    const makePrisma = (enrollments: Array<{ id: string; classId: string }>) =>
      prismaForToday(
        {
          assessmentSession: {
            findMany: vi.fn().mockResolvedValue([
              session({
                id: "teacher-class-b",
                enrollmentId: ENROLLMENT_B,
                purpose: "REMEDIATION",
                remediationOrigin: "TEACHER_ASSIGNED",
                remediationFocus: { mode: "FAMILY", family: "READ_ALOUD" },
                status: "CREATED",
                createdAt: new Date("2026-08-24T02:00:00.000Z"),
                updatedAt: new Date("2026-08-24T02:05:00.000Z"),
                completedAt: null,
                practiceDefinitionId: null,
                report: null,
                items: [{ id: "item-1" }],
              }),
            ]),
          },
          practiceDelivery: {
            findMany: vi.fn().mockResolvedValue([
              {
                createdAt: new Date("2026-08-24T03:00:00.000Z"),
                practiceVersion: {
                  definitionId: "level-one",
                  definition: { title: "水平一级" },
                },
              },
            ]),
          },
        },
        enrollments,
      );
    const first = await new StudentDashboardService(
      makePrisma([
        { id: ENROLLMENT_A, classId: CLASS_A },
        { id: ENROLLMENT_B, classId: CLASS_B },
      ]) as any,
      {} as any,
    ).getTodayTasks(auth(), SCHOOL_ID);
    const reversed = await new StudentDashboardService(
      makePrisma([
        { id: ENROLLMENT_B, classId: CLASS_B },
        { id: ENROLLMENT_A, classId: CLASS_A },
      ]) as any,
      {} as any,
    ).getTodayTasks(auth(), SCHOOL_ID);

    expect(reversed).toEqual(first);
  });

  it("selects the latest completed formal assessment across enrollments", async () => {
    const prisma = prismaForToday(
      {
        assessmentSession: {
          findMany: vi.fn().mockResolvedValue([
            session({
              id: "formal-old",
              enrollmentId: ENROLLMENT_A,
              completedAt: new Date("2026-08-20T01:00:00.000Z"),
              createdAt: new Date("2026-08-20T01:00:00.000Z"),
              report: { overallScore: 70, summary: diagnosisSummary() },
            }),
            session({
              id: "formal-new",
              enrollmentId: ENROLLMENT_B,
              completedAt: new Date("2026-08-24T01:00:00.000Z"),
              createdAt: new Date("2026-08-24T01:00:00.000Z"),
              report: { overallScore: 92, summary: diagnosisSummary() },
            }),
          ]),
        },
        practiceDefinition: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: "level-one", title: "水平一级", difficulty: "水平一级" },
            ]),
        },
      },
      [
        { id: ENROLLMENT_A, classId: CLASS_A },
        { id: ENROLLMENT_B, classId: CLASS_B },
      ],
    );
    const service = new StudentDashboardService(prisma as any, {} as any);

    const result = await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(result.summary.latestFormalAssessment).toEqual({
      level: "水平一级",
      score: 92,
      completedAt: "2026-08-24T01:00:00.000Z",
    });
  });

  it("discovers a published Level 1 baseline delivered only to the second class", async () => {
    const prisma = prismaForToday(
      {
        practiceDelivery: {
          findMany: vi.fn().mockResolvedValue([
            {
              createdAt: new Date("2026-08-24T03:00:00.000Z"),
              practiceVersion: {
                definitionId: "level-one",
                definition: { title: "水平一级综合测评" },
              },
            },
          ]),
        },
      },
      [
        { id: ENROLLMENT_A, classId: CLASS_A },
        { id: ENROLLMENT_B, classId: CLASS_B },
      ],
    );
    const service = new StudentDashboardService(prisma as any, {} as any);

    const result = await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(result.primaryAction).toMatchObject({
      kind: "BASELINE",
      target: { practiceDefinitionId: "level-one" },
    });
    expect(prisma.practiceDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: SCHOOL_ID,
          OR: [
            { studentId: STUDENT_ID },
            { studentId: null, classId: { in: [CLASS_A, CLASS_B] } },
          ],
        }),
      }),
    );
  });

  it("keeps all Today reads scoped to the current school", async () => {
    const prisma = prismaForToday();
    const service = new StudentDashboardService(prisma as any, {} as any);

    await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(prisma.assessmentSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: SCHOOL_ID }),
      }),
    );
    expect(prisma.practiceDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: SCHOOL_ID }),
      }),
    );
    expect(prisma.assignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: SCHOOL_ID }),
      }),
    );
  });

  it("keeps non-reading teacher review wording generic", async () => {
    const prisma = prismaForToday({
      assessmentSession: {
        findMany: vi.fn().mockResolvedValue([
          session({
            id: "picture-review",
            purpose: "REMEDIATION",
            remediationOrigin: "TEACHER_ASSIGNED",
            remediationFocus: { mode: "FAMILY", family: "PICTURE_SPEAKING" },
            status: "PROCESSING",
            completedAt: null,
            items: [{ id: "item-1" }],
          }),
          session({
            id: "rubric-review",
            purpose: "REMEDIATION",
            remediationOrigin: "TEACHER_ASSIGNED",
            remediationFocus: { mode: "FAMILY", family: "RUBRIC" },
            status: "PROCESSING",
            completedAt: null,
            items: [{ id: "item-2" }],
          }),
        ]),
      },
    });
    const service = new StudentDashboardService(prisma as any, {} as any);

    const result = await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(result.waiting).toEqual(
      expect.arrayContaining([
        {
          kind: "TEACHER_REVIEW",
          title: "看图说话专项巩固",
          reason: "这项练习正在等待老师复核。",
          itemCount: 1,
        },
        {
          kind: "TEACHER_REVIEW",
          title: "专项巩固",
          reason: "这项练习正在等待老师复核。",
          itemCount: 1,
        },
      ]),
    );
    expect(result.waiting.every((item) => !item.reason.includes("朗读"))).toBe(
      true,
    );
  });
});
