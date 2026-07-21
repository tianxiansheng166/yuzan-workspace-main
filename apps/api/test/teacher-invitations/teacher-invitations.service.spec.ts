import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/index.js";
import { TeacherInvitationsService } from "../../src/modules/teacher-invitations/teacher-invitations.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const teacherId = "44444444-4444-4444-8444-444444444444";
const invitation = {
  id: "55555555-5555-4555-8555-555555555555",
  schoolId,
  classId,
  teacherUserId: teacherId,
  code: "TC-ABCDE-12345",
  maxUses: 3,
  usedCount: 0,
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  class: { id: classId, name: "测试班", grade: "七年级" },
};

const studentAuth: any = {
  tenant: { schoolId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT] },
};

function fixture() {
  const prisma: any = {
    teacherInvitation: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    enrollment: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    membership: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(prisma));
  return prisma;
}

describe("TeacherInvitationsService", () => {
  it("binds a student to the invitation school and class, consuming one use", async () => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue(invitation);
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.enrollment.findFirst.mockResolvedValue({ id: "teacher-enrollment" });
    prisma.teacherInvitation.updateMany.mockResolvedValue({ count: 1 });

    const result = await new TeacherInvitationsService(prisma).bind(studentAuth, { code: " tc-abcde-12345 " });

    expect(result).toMatchObject({ alreadyBound: false, schoolId, class: { id: classId } });
    expect(prisma.teacherInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: invitation.id, usedCount: { lt: invitation.maxUses } }),
      data: { usedCount: { increment: 1 } },
    }));
    expect(prisma.membership.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId_userId_role: { schoolId, userId: studentId, role: MembershipRole.STUDENT } },
      create: expect.objectContaining({ schoolId, userId: studentId, status: "ACTIVE" }),
    }));
    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { classId_userId_role: { classId, userId: studentId, role: MembershipRole.STUDENT } },
      create: expect.objectContaining({ schoolId, classId, userId: studentId, status: "ACTIVE" }),
    }));
  });

  it("is idempotent for an active student enrollment and does not consume another use", async () => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue(invitation);
    prisma.enrollment.findUnique.mockResolvedValue({ id: "existing", status: "ACTIVE" });

    const result = await new TeacherInvitationsService(prisma).bind(studentAuth, { code: invitation.code });

    expect(result.alreadyBound).toBe(true);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it("does not allow a teacher to create an invitation in another tenant", async () => {
    const prisma = fixture();
    const auth: any = { tenant: { schoolId }, principal: { userId: teacherId, roles: [MembershipRole.TEACHER] } };

    await expect(new TeacherInvitationsService(prisma).create(auth, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { classId })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
