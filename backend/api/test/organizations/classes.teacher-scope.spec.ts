import { describe, expect, it, vi } from "vitest";
import { createAuthContext, MembershipRole, MembershipStatus } from "../../src/common/security/index.js";
import { ClassesService } from "../../src/modules/classes/classes.service.js";

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
  const classRepo: any = { findById: vi.fn().mockResolvedValue(classItem) };
  const prisma: any = {
    enrollment: { findMany: vi.fn() },
    assignment: { findMany: vi.fn() },
    submission: { findMany: vi.fn(), count: vi.fn() },
    assessmentSession: { findMany: vi.fn(), count: vi.fn() },
    activityProgress: { findMany: vi.fn() },
  };
  const service = new ClassesService(classRepo, prisma, {} as any);
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

describe("ClassesService teacher class scope", () => {
  it.each([
    ["class dashboard", (service: ClassesService, auth: any) => service.getClassDashboard(auth, schoolId, classId)],
    ["student summaries", (service: ClassesService, auth: any) => service.getStudentSummaries(auth, schoolId, classId)],
    ["assignment summaries", (service: ClassesService, auth: any) => service.getAssignmentSummaries(auth, schoolId, classId)],
    ["assessment summaries", (service: ClassesService, auth: any) => service.getAssessmentSummaries(auth, schoolId, classId)],
    ["pending statistics", (service: ClassesService, auth: any) => service.getClassPendingStats(auth, schoolId, classId)],
    ["class members", (service: ClassesService, auth: any) => service.listClassMembers(auth, schoolId, classId)],
  ])("does not expose %s for another teacher's class", async (_label, invoke) => {
    const { service, prisma, auth } = setup();
    await expect(invoke(service, auth)).rejects.toMatchObject({ status: 404 });
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(prisma.assignment.findMany).not.toHaveBeenCalled();
    expect(prisma.submission.findMany).not.toHaveBeenCalled();
  });
});
