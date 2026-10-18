import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/index.js";
import { TeacherService } from "../../src/modules/teacher/teacher.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const classId = "22222222-2222-4222-8222-222222222222";
const student1 = "33333333-3333-4333-8333-333333333333";
const student2 = "44444444-4444-4444-8444-444444444444";
const teacherId = "55555555-5555-4555-8555-555555555555";
const assignmentId = "66666666-6666-4666-8666-666666666666";

function fixture() {
  const prisma: any = {
    enrollment: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    courseVersion: { count: vi.fn(), findMany: vi.fn() },
    assignment: { count: vi.fn(), findMany: vi.fn() },
    submission: { count: vi.fn(), findMany: vi.fn() },
  };
  prisma.enrollment.findMany
    .mockResolvedValueOnce([{ classId }])
    .mockResolvedValueOnce([
      { id: student1, classId },
      { id: student2, classId },
    ]);
  prisma.user.findUnique.mockResolvedValue({ displayName: "测试教师甲" });
  prisma.school.findUnique.mockResolvedValue({ name: "测试学校甲" });
  prisma.courseVersion.count.mockResolvedValue(2);
  prisma.courseVersion.findMany.mockResolvedValue([
    { id: "course-1", title: "测试课程草稿", gradeBand: "五年级", updatedAt: new Date("2026-10-17T00:00:00Z") },
  ]);
  prisma.assignment.count.mockResolvedValue(3);
  prisma.assignment.findMany.mockResolvedValue([
    {
      id: assignmentId,
      title: "真实朗读任务",
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      targets: [{ targetType: "CLASS", classId, enrollmentId: null }],
    },
  ]);
  prisma.submission.count.mockResolvedValue(1);
  prisma.submission.findMany.mockImplementation((query: any) => {
    if (query.where.status === "NEEDS_REVIEW") {
      return Promise.resolve([
        {
          id: "77777777-7777-4777-8777-777777777777",
          createdAt: new Date("2026-10-18T01:00:00Z"),
          assignment: { title: "真实复核任务" },
          enrollment: { user: { displayName: "测试学生甲" } },
        },
      ]);
    }
    return Promise.resolve([{ assignmentId, enrollmentId: student1 }]);
  });
  return prisma;
}

const auth: any = {
  tenant: { schoolId },
  principal: { userId: teacherId, roles: [MembershipRole.TEACHER] },
};

describe("TeacherService.getDashboard", () => {
  it("returns the signed-in teacher's school, scoped class counts, real assignments and review entries", async () => {
    const prisma = fixture();
    const result = await new TeacherService(prisma).getDashboard(auth, schoolId);

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

    expect(prisma.enrollment.findMany.mock.calls[0][0].where).toMatchObject({ userId: teacherId, schoolId, role: "TEACHER" });
    expect(prisma.courseVersion.count.mock.calls[0][0].where.course.authorUserId).toBe(teacherId);
    expect(prisma.assignment.count.mock.calls[0][0].where.targets.some.OR).toEqual(expect.arrayContaining([
      { classId: { in: [classId] } },
      { enrollmentId: { in: [student1, student2] } },
    ]));
  });

  it("returns empty authorized learning data when a teacher has no class", async () => {
    const prisma = fixture();
    prisma.enrollment.findMany
      .mockReset()
      .mockResolvedValueOnce([]);
    const result = await new TeacherService(prisma).getDashboard(auth, schoolId);

    expect(result.workflow.find((item: any) => item.id === "student")?.count).toBe(0);
    expect(result.workflow.find((item: any) => item.id === "task")?.count).toBe(0);
    expect(result.tasks).toEqual([]);
    expect(result.reviews).toEqual([]);
    expect(prisma.assignment.count).not.toHaveBeenCalled();
    expect(prisma.assignment.findMany).not.toHaveBeenCalled();
  });

  it("rejects cross-school dashboard access before reading any data", async () => {
    const prisma = fixture();
    await expect(new TeacherService(prisma).getDashboard(auth, otherSchoolId)).rejects.toThrow();
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(prisma.courseVersion.count).not.toHaveBeenCalled();
  });
});
