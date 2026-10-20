import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import {
  MembershipStatus,
  type AuthContext,
} from "../../src/common/security/auth.types.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";
import type { AssessmentSessionStatus, AssessmentSessionPurpose, AssessmentRemediationOrigin } from "../../src/modules/assessment/domain/assessment.types.js";
import type { FeedbackRepositoryPort } from "../../src/modules/feedback/ports/feedback-repository.port.js";
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

type QueryArgs = { where: Record<string, unknown> };
type QueryFunction<T> = (args: QueryArgs) => Promise<T>;
type QueryMock<T> = ReturnType<typeof vi.fn<QueryFunction<T>>>;
type TodayEnrollment = { id: string; classId: string };
type TodaySession = {
  id: string;
  enrollmentId: string;
  purpose: AssessmentSessionPurpose;
  remediationOrigin: AssessmentRemediationOrigin | null;
  remediationFocus: unknown;
  status: AssessmentSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  practiceDefinitionId: string | null;
  report: { overallScore: number | null; summary: unknown } | null;
  items: Array<{ id: string }>;
};
type TodayAssignment = {
  id: string;
  title: string;
  dueAt: Date;
  status: string;
  courseVersionId: string | null;
  courseVersion: { title: string } | null;
};
type TodayDelivery = {
  createdAt: Date;
  practiceVersion: { definitionId: string; definition: { title: string } };
};
type TodayDefinition = { id: string; title: string; difficulty: string };
type TodayPrisma = {
  enrollment: { findMany: QueryMock<TodayEnrollment[]> };
  assessmentSession: { findMany: QueryMock<TodaySession[]> };
  assignment: { findMany: QueryMock<TodayAssignment[]> };
  practiceDelivery: { findMany: QueryMock<TodayDelivery[]> };
  practiceDefinition: { findMany: QueryMock<TodayDefinition[]> };
  activityProgress: { count: QueryMock<number> };
  offlineContentPackage: { count: QueryMock<number> };
};
type TodayPrismaOverrides = {
  assessmentSession?: Partial<TodayPrisma["assessmentSession"]>;
  assignment?: Partial<TodayPrisma["assignment"]>;
  practiceDelivery?: Partial<TodayPrisma["practiceDelivery"]>;
  practiceDefinition?: Partial<TodayPrisma["practiceDefinition"]>;
  activityProgress?: Partial<TodayPrisma["activityProgress"]>;
  offlineContentPackage?: Partial<TodayPrisma["offlineContentPackage"]>;
};

function queryMock<T>(result: T): QueryMock<T> {
  return vi.fn<QueryFunction<T>>((args) => {
    void args;
    return Promise.resolve(result);
  });
}

function createStudentDashboardService(prisma: TodayPrisma): StudentDashboardService {
  const unexpected = <T>(): Promise<T> => Promise.reject(new Error("unexpected feedback query"));
  const feedbackRepository: FeedbackRepositoryPort = {
    findById: () => unexpected(),
    findBySubmissionId: () => unexpected(),
    findPendingBySchool: () => unexpected(),
    findByStudentEnrollments: () => Promise.resolve({ items: [], nextCursor: null, hasMore: false }),
    save: () => unexpected(),
  };
  return new StudentDashboardService(prisma as unknown as PrismaService, feedbackRepository);
}

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
  overrides: TodayPrismaOverrides = {},
  enrollments: TodayEnrollment[] = [{ id: ENROLLMENT_ID, classId: CLASS_ID }],
): TodayPrisma {
  return {
    enrollment: { findMany: queryMock(enrollments) },
    assessmentSession: { findMany: queryMock<TodaySession[]>([]) , ...overrides.assessmentSession },
    assignment: { findMany: queryMock<TodayAssignment[]>([]), ...overrides.assignment },
    practiceDelivery: { findMany: queryMock<TodayDelivery[]>([]), ...overrides.practiceDelivery },
    practiceDefinition: { findMany: queryMock<TodayDefinition[]>([]), ...overrides.practiceDefinition },
    activityProgress: { count: queryMock(0), ...overrides.activityProgress },
    offlineContentPackage: { count: queryMock(0), ...overrides.offlineContentPackage },
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

function session(overrides: Partial<TodaySession> = {}): TodaySession {
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
    const service = createStudentDashboardService(prisma);
    await expect(
      service.getTodayTasks(auth(), OTHER_SCHOOL_ID),
    ).rejects.toThrow();
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("derives a teacher-assigned action from the current enrollment only", async () => {
    const prisma = prismaForToday({
      assessmentSession: {
        findMany: queryMock<TodaySession[]>([
          {
            id: "55555555-5555-4555-8555-555555555555",
            enrollmentId: ENROLLMENT_ID,
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
    const service = createStudentDashboardService(prisma);
    const result = await service.getTodayTasks(auth(), SCHOOL_ID);
    expect(result).toMatchObject({
      version: "student-today-v1",
      primaryAction: {
        kind: "TEACHER_REMEDIATION",
        reason: "老师给你布置了 2 道「朗读句子」巩固题。",
      },
    });
    const enrollmentQuery = prisma.enrollment.findMany.mock.calls[0]?.[0];
    expect(enrollmentQuery?.where.userId).toBe(STUDENT_ID);
    expect(enrollmentQuery?.where.schoolId).toBe(SCHOOL_ID);
    const sessionsQuery = prisma.assessmentSession.findMany.mock.calls[0]?.[0];
    expect(sessionsQuery?.where.schoolId).toBe(SCHOOL_ID);
    expect(sessionsQuery?.where.enrollmentId).toEqual({ in: [ENROLLMENT_ID] });
    expect(JSON.stringify(result)).not.toMatch(
      /correctAnswer|referenceAnswer|acceptedAnswers|scoringSpec|rubric|deductionRules|sourceTrace|providerAudit|rawResponse|transcript|candidatePoints/,
    );
  });

  it("includes teacher remediation from a non-first active enrollment", async () => {
    const prisma = prismaForToday(
      {
        assessmentSession: {
          findMany: queryMock<TodaySession[]>([
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
    const service = createStudentDashboardService(prisma);

    const result = await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(result.primaryAction).toMatchObject({
      kind: "TEACHER_REMEDIATION",
      title: "老师布置的看图说话专项巩固",
    });
    const sessionsQuery = prisma.assessmentSession.findMany.mock.calls[0]?.[0];
    expect(sessionsQuery?.where.enrollmentId).toEqual({ in: [ENROLLMENT_A, ENROLLMENT_B] });
  });

  it("is deep-equal when active enrollment insertion order is reversed", async () => {
    const makePrisma = (enrollments: Array<{ id: string; classId: string }>) =>
      prismaForToday(
        {
          assessmentSession: {
            findMany: queryMock<TodaySession[]>([
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
            findMany: queryMock<TodayDelivery[]>([
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
    const first = await createStudentDashboardService(makePrisma([
      { id: ENROLLMENT_A, classId: CLASS_A },
      { id: ENROLLMENT_B, classId: CLASS_B },
    ])).getTodayTasks(auth(), SCHOOL_ID);
    const reversed = await createStudentDashboardService(makePrisma([
      { id: ENROLLMENT_B, classId: CLASS_B },
      { id: ENROLLMENT_A, classId: CLASS_A },
    ])).getTodayTasks(auth(), SCHOOL_ID);

    expect(reversed).toEqual(first);
  });

  it("selects the latest completed formal assessment across enrollments", async () => {
    const prisma = prismaForToday(
      {
        assessmentSession: {
          findMany: queryMock<TodaySession[]>([
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
          findMany: queryMock<TodayDefinition[]>([
              { id: "level-one", title: "水平一级", difficulty: "水平一级" },
          ]),
        },
      },
      [
        { id: ENROLLMENT_A, classId: CLASS_A },
        { id: ENROLLMENT_B, classId: CLASS_B },
      ],
    );
    const service = createStudentDashboardService(prisma);

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
          findMany: queryMock<TodayDelivery[]>([
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
    const service = createStudentDashboardService(prisma);

    const result = await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(result.primaryAction).toMatchObject({
      kind: "BASELINE",
      target: { practiceDefinitionId: "level-one" },
    });
    const deliveryQuery = prisma.practiceDelivery.findMany.mock.calls[0]?.[0];
    expect(deliveryQuery?.where.schoolId).toBe(SCHOOL_ID);
    expect(deliveryQuery?.where.OR).toEqual([
      { studentId: STUDENT_ID },
      { studentId: null, classId: { in: [CLASS_A, CLASS_B] } },
    ]);
  });

  it("keeps all Today reads scoped to the current school", async () => {
    const prisma = prismaForToday();
    const service = createStudentDashboardService(prisma);

    await service.getTodayTasks(auth(), SCHOOL_ID);

    expect(prisma.assessmentSession.findMany.mock.calls[0]?.[0].where.schoolId).toBe(SCHOOL_ID);
    expect(prisma.practiceDelivery.findMany.mock.calls[0]?.[0].where.schoolId).toBe(SCHOOL_ID);
    expect(prisma.assignment.findMany.mock.calls[0]?.[0].where.schoolId).toBe(SCHOOL_ID);
  });

  it("matches Assignment target types so a student target cannot expose a task to classmates", async () => {
    const assignedTask = {
      id: "55555555-5555-4555-8555-555555555555",
      title: "TEST_FIXTURE_ONLY 定向补练",
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "OPEN",
      courseVersionId: "66666666-6666-4666-8666-666666666666",
      courseVersion: { title: "TEST_FIXTURE_ONLY 已发布课程" },
    };
    const assignmentFindMany = queryMock<TodayAssignment[]>([assignedTask]);
    const studentAEnrollment = { id: ENROLLMENT_A, classId: CLASS_A };
    const prismaA = prismaForToday(
      { assignment: { findMany: assignmentFindMany } },
      [studentAEnrollment],
    );
    const resultA = await createStudentDashboardService(prismaA).getTodayTasks(auth(), SCHOOL_ID);

    expect(resultA.legacyTasks).toMatchObject([
      { assignmentId: assignedTask.id, status: "OPEN" },
    ]);
    const assignmentQuery = assignmentFindMany.mock.calls[0]?.[0];
    expect(assignmentQuery?.where.status).toBe("OPEN");
    expect(assignmentQuery?.where.targets).toEqual({
      some: {
        OR: [
          { targetType: "CLASS", classId: { in: [CLASS_A] } },
          { targetType: "STUDENT", enrollmentId: { in: [ENROLLMENT_A] } },
        ],
      },
    });

    const assignmentForClassmate = queryMock<TodayAssignment[]>([]);
    const prismaC = prismaForToday(
      { assignment: { findMany: assignmentForClassmate } },
      [{ id: ENROLLMENT_B, classId: CLASS_A }],
    );
    const resultC = await createStudentDashboardService(prismaC).getTodayTasks(auth(), SCHOOL_ID);
    expect(resultC.legacyTasks).toEqual([]);
    const classmateAssignmentQuery = assignmentForClassmate.mock.calls[0]?.[0];
    expect(classmateAssignmentQuery?.where.targets).toEqual({
      some: {
        OR: [
          { targetType: "CLASS", classId: { in: [CLASS_A] } },
          { targetType: "STUDENT", enrollmentId: { in: [ENROLLMENT_B] } },
        ],
      },
    });
  });

  it("keeps non-reading teacher review wording generic", async () => {
    const prisma = prismaForToday({
      assessmentSession: {
        findMany: queryMock<TodaySession[]>([
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
    const service = createStudentDashboardService(prisma);

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
