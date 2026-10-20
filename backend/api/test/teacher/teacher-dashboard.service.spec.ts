import { describe, expect, it, vi } from "vitest";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";
import { TeacherService } from "../../src/modules/teacher/teacher.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const classId = "22222222-2222-4222-8222-222222222222";
const student1 = "33333333-3333-4333-8333-333333333333";
const student2 = "44444444-4444-4444-8444-444444444444";
const teacherId = "55555555-5555-4555-8555-555555555555";
const assignmentId = "66666666-6666-4666-8666-666666666666";

type EnrollmentQuery = {
  where: {
    userId?: string;
    schoolId: string;
    classId?: { in: string[] };
    role: string;
    status: string;
  };
};
type EnrollmentRow = { id?: string; classId: string };
type CourseCountQuery = { where: { course: { authorUserId: string } } };
type AssignmentTargetFilter = {
  classId?: { in: string[] };
  enrollmentId?: { in: string[] };
};
type AssignmentCountQuery = {
  where: {
    targets: {
      some: {
        OR: AssignmentTargetFilter[];
      };
    };
  };
};
type SubmissionFindManyQuery = {
  where: { status: string | { in: string[] } };
};
function fixture() {
  const prisma = {
    enrollment: {
      findMany: vi.fn((query: EnrollmentQuery) =>
        Promise.resolve<EnrollmentRow[]>(
          query.where.role === "TEACHER"
            ? [{ classId }]
            : [
                { id: student1, classId },
                { id: student2, classId },
              ],
        ),
      ),
    },
    user: { findUnique: vi.fn(() => Promise.resolve({ displayName: "测试教师甲" })) },
    school: { findUnique: vi.fn(() => Promise.resolve({ name: "测试学校甲" })) },
    courseVersion: {
      count: vi.fn((query: CourseCountQuery) =>
        Promise.resolve(query.where.course.authorUserId === teacherId ? 2 : 0),
      ),
      findMany: vi.fn(() =>
        Promise.resolve([
          { id: "course-1", title: "测试课程草稿", gradeBand: "五年级", updatedAt: new Date("2026-10-17T00:00:00Z") },
        ]),
      ),
    },
    assignment: {
      count: vi.fn((query: AssignmentCountQuery) =>
        Promise.resolve(
          query.where.targets.some.OR.some((target) =>
            target.classId?.in.includes(classId) === true ||
            target.enrollmentId?.in.some((id) => [student1, student2].includes(id)) === true,
          ) ? 3 : 0,
        ),
      ),
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            id: assignmentId,
            title: "真实朗读任务",
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            targets: [{ targetType: "CLASS", classId, enrollmentId: null }],
          },
        ]),
      ),
    },
    submission: {
      count: vi.fn(() => Promise.resolve(1)),
      findMany: vi.fn((query: SubmissionFindManyQuery) =>
        Promise.resolve(
          query.where.status === "NEEDS_REVIEW"
            ? [
                {
                  id: "77777777-7777-4777-8777-777777777777",
                  createdAt: new Date("2026-10-18T01:00:00Z"),
                  assignment: { title: "真实复核任务" },
                  enrollment: { user: { displayName: "测试学生甲" } },
                },
              ]
            : [{ assignmentId, enrollmentId: student1 }],
        ),
      ),
    },
  };
  return prisma;
}

const auth = createAuthContext(
  "teacher-dashboard-test",
  {
    userId: teacherId,
    roles: [MembershipRole.TEACHER],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  },
  { schoolId },
);

describe("TeacherService.getDashboard", () => {
  it("returns the signed-in teacher's school, scoped class counts, real assignments and review entries", async () => {
    const prisma = fixture();
    const result = await new TeacherService(prisma as unknown as PrismaService).getDashboard(auth, schoolId);

    expect(result.greeting).toMatchObject({ name: "测试教师甲", schoolName: "测试学校甲", priorityCount: 1 });
    expect(result.workflow).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "course", count: 2 }),
      expect.objectContaining({ id: "task", count: 3 }),
      expect.objectContaining({ id: "review", count: 1 }),
      expect.objectContaining({ id: "student", count: 2 }),
    ]));
    expect(result.tasks).toEqual([
      expect.objectContaining({ id: assignmentId, title: "真实朗读任务", done: 1, total: 2 }),
    ]);
    expect(result.priority).toMatchObject({ assignmentId, count: 1 });
    expect(result.reviews[0]).toMatchObject({ studentName: "测试学生甲", taskTitle: "真实复核任务" });
    expect(result).not.toHaveProperty("students");

    const [enrollmentFindManyCall] = prisma.enrollment.findMany.mock.calls;
    const [courseCountCall] = prisma.courseVersion.count.mock.calls;
    const [assignmentCountCall] = prisma.assignment.count.mock.calls;
    if (!enrollmentFindManyCall || !courseCountCall || !assignmentCountCall) {
      throw new Error("expected the scoped teacher dashboard queries");
    }
    expect(enrollmentFindManyCall[0].where).toMatchObject({ userId: teacherId, schoolId, role: "TEACHER" });
    expect(courseCountCall[0].where.course.authorUserId).toBe(teacherId);
    expect(assignmentCountCall[0].where.targets.some.OR).toEqual(expect.arrayContaining([
      { classId: { in: [classId] } },
      { enrollmentId: { in: [student1, student2] } },
    ]));
  });

  it("returns empty authorized learning data when a teacher has no class", async () => {
    const prisma = fixture();
    prisma.enrollment.findMany
      .mockReset()
      .mockResolvedValueOnce([]);
    const result = await new TeacherService(prisma as unknown as PrismaService).getDashboard(auth, schoolId);

    expect(result.workflow.find((item) => item.id === "student")?.count).toBe(0);
    expect(result.workflow.find((item) => item.id === "task")?.count).toBe(0);
    expect(result.tasks).toEqual([]);
    expect(result.reviews).toEqual([]);
    expect(prisma.assignment.count).not.toHaveBeenCalled();
    expect(prisma.assignment.findMany).not.toHaveBeenCalled();
  });

  it("rejects cross-school dashboard access before reading any data", async () => {
    const prisma = fixture();
    await expect(new TeacherService(prisma as unknown as PrismaService).getDashboard(auth, otherSchoolId)).rejects.toThrow();
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(prisma.courseVersion.count).not.toHaveBeenCalled();
  });
});
