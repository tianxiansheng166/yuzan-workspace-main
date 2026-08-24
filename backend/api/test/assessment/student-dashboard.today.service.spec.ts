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

function prismaForToday(overrides: Record<string, unknown> = {}) {
  return {
    enrollment: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: ENROLLMENT_ID, classId: CLASS_ID }]),
    },
    assessmentSession: { findMany: vi.fn().mockResolvedValue([]) },
    assignment: { findMany: vi.fn().mockResolvedValue([]) },
    practiceDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    practiceDefinition: { findMany: vi.fn().mockResolvedValue([]) },
    activityProgress: { count: vi.fn().mockResolvedValue(0) },
    offlineContentPackage: { count: vi.fn().mockResolvedValue(0) },
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
          enrollmentId: ENROLLMENT_ID,
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /correctAnswer|referenceAnswer|acceptedAnswers|scoringSpec|rubric|deductionRules|sourceTrace|providerAudit|rawResponse|transcript|candidatePoints/,
    );
  });
});
