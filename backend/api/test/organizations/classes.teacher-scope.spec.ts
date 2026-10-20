import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../../src/common/security/auth.types.js";
import { createAuthContext, MembershipRole, MembershipStatus } from "../../src/common/security/index.js";
import { ClassesService } from "../../src/modules/classes/classes.service.js";
import type { ClassRepositoryPort } from "../../src/modules/classes/ports/class-repository.port.js";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import { PrismaService } from "../../src/shared/database/prisma.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const teacherId = "33333333-3333-4333-8333-333333333333";

function setup() {
  const classItem = {
    id: classId,
    schoolId,
    termId: "44444444-4444-4444-8444-444444444444",
    name: "其他教师班级",
    grade: "五年级",
    teacherUserIds: ["55555555-5555-4555-8555-555555555555"],
    studentCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const classRepo = { findById: vi.fn(() => Promise.resolve(classItem)) };
  const prisma = {
    enrollment: { findMany: vi.fn(() => Promise.resolve([])) },
    assignment: { findMany: vi.fn(() => Promise.resolve([])) },
    submission: { findMany: vi.fn(() => Promise.resolve([])), count: vi.fn(() => Promise.resolve(0)) },
    assessmentSession: { findMany: vi.fn(() => Promise.resolve([])), count: vi.fn(() => Promise.resolve(0)) },
    activityProgress: { findMany: vi.fn(() => Promise.resolve([])) },
  };
  const service = new ClassesService(
    classRepo as unknown as ClassRepositoryPort,
    prisma as unknown as PrismaService,
    {} as unknown as AssessmentService,
  );
  const auth = createAuthContext(
    "request-id",
    {
      userId: teacherId,
      roles: [MembershipRole.TEACHER],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "session",
    },
    { schoolId },
  );
  return { service, classRepo, prisma, auth };
}

type ScopeCall = (
  service: ClassesService,
  auth: AuthContext,
) => Promise<unknown>;

const scopedReads: Array<[string, ScopeCall]> = [
  ["class dashboard", (service, auth) => service.getClassDashboard(auth, schoolId, classId)],
  ["student summaries", (service, auth) => service.getStudentSummaries(auth, schoolId, classId)],
  ["assignment summaries", (service, auth) => service.getAssignmentSummaries(auth, schoolId, classId)],
  ["assessment summaries", (service, auth) => service.getAssessmentSummaries(auth, schoolId, classId)],
  ["pending statistics", (service, auth) => service.getClassPendingStats(auth, schoolId, classId)],
  ["class members", (service, auth) => service.listClassMembers(auth, schoolId, classId)],
];

describe("ClassesService teacher class scope", () => {
  it.each(scopedReads)("does not expose %s for another teacher's class", async (_label, invoke) => {
    const { service, prisma, auth } = setup();
    await expect(invoke(service, auth)).rejects.toMatchObject({ status: 404 });
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(prisma.assignment.findMany).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).not.toHaveBeenCalled();
  });
});
