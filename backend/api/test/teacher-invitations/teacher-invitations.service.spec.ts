import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
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
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  class: { id: classId, name: "测试班", grade: "七年级" },
};

const studentAuth: any = {
  requestId: "request-student",
  tenant: { schoolId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT] },
};

const teacherAuth: any = {
  requestId: "request-teacher",
  tenant: { schoolId },
  principal: { userId: teacherId, roles: [MembershipRole.TEACHER] },
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

  it("revokes only an owned active invitation and writes one UTC audit in the transaction", async () => {
    const prisma = fixture();
    const revokedAt = new Date();
    const updated = { ...invitation, usedCount: 1, revokedAt };
    prisma.teacherInvitation.findUnique
      .mockResolvedValueOnce({ ...invitation, usedCount: 1 })
      .mockResolvedValueOnce(updated);
    prisma.enrollment.findFirst.mockResolvedValue({ id: "active-teacher-enrollment" });
    prisma.teacherInvitation.updateMany.mockResolvedValue({ count: 1 });

    const result = await new TeacherInvitationsService(prisma).revoke(teacherAuth, schoolId, invitation.id);

    expect(result).toMatchObject({
      id: invitation.id,
      code: null,
      status: "REVOKED",
      usedCount: 1,
      class: { id: classId },
    });
    expect(result.expiresAt).toBe(invitation.expiresAt.toISOString());
    expect(prisma.teacherInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: invitation.id,
        schoolId,
        teacherUserId: teacherId,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
        usedCount: { lt: invitation.maxUses },
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: teacherId,
        schoolId,
        action: "TEACHER_INVITATION_REVOKED",
        resourceType: "TeacherInvitation",
        resourceId: invitation.id,
        requestId: teacherAuth.requestId,
        afterSummary: expect.objectContaining({
          invitationId: invitation.id,
          classId,
          revokedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
          usedCount: 1,
        }),
      }),
    });
  });

  it("returns an already revoked invitation idempotently without a second audit", async () => {
    const prisma = fixture();
    const stored = { ...invitation, revokedAt: new Date("2026-10-18T12:00:00.000Z") };
    prisma.teacherInvitation.findUnique.mockResolvedValue(stored);
    prisma.enrollment.findFirst.mockResolvedValue({ id: "active-teacher-enrollment" });

    const first = await new TeacherInvitationsService(prisma).revoke(teacherAuth, schoolId, invitation.id);
    const second = await new TeacherInvitationsService(prisma).revoke(teacherAuth, schoolId, invitation.id);

    expect(first).toMatchObject({ status: "REVOKED", code: null });
    expect(second).toEqual(first);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("reconciles a concurrent revoke claim that already committed without duplicating the audit", async () => {
    const prisma = fixture();
    const revoked = { ...invitation, revokedAt: new Date("2026-10-18T12:00:00.000Z") };
    prisma.teacherInvitation.findUnique.mockResolvedValueOnce(invitation).mockResolvedValueOnce(revoked);
    prisma.enrollment.findFirst.mockResolvedValue({ id: "active-teacher-enrollment" });
    prisma.teacherInvitation.updateMany.mockResolvedValue({ count: 0 });

    const result = await new TeacherInvitationsService(prisma).revoke(teacherAuth, schoolId, invitation.id);

    expect(result).toMatchObject({ status: "REVOKED", code: null });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", { expiresAt: new Date(Date.now() - 1_000) }],
    ["exhausted", { usedCount: invitation.maxUses }],
  ])("does not revoke an already %s invitation", async (_label, changes) => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue({ ...invitation, ...changes });
    prisma.enrollment.findFirst.mockResolvedValue({ id: "active-teacher-enrollment" });

    await expect(new TeacherInvitationsService(prisma).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing invitation and 403 for non-owner or inactive-class teachers", async () => {
    const missing = fixture();
    missing.teacherInvitation.findUnique.mockResolvedValue(null);
    await expect(new TeacherInvitationsService(missing).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(NotFoundException);

    const otherTeacher = fixture();
    otherTeacher.teacherInvitation.findUnique.mockResolvedValue({ ...invitation, teacherUserId: "66666666-6666-4666-8666-666666666666" });
    await expect(new TeacherInvitationsService(otherTeacher).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(otherTeacher.enrollment.findFirst).not.toHaveBeenCalled();

    const inactiveTeacher = fixture();
    inactiveTeacher.teacherInvitation.findUnique.mockResolvedValue(invitation);
    inactiveTeacher.enrollment.findFirst.mockResolvedValue(null);
    await expect(new TeacherInvitationsService(inactiveTeacher).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(inactiveTeacher.teacherInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a tenant mismatch before reading invitation data", async () => {
    const prisma = fixture();
    const crossSchoolTeacher = { ...teacherAuth, tenant: { schoolId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } };

    await expect(new TeacherInvitationsService(prisma).revoke(crossSchoolTeacher, schoolId, invitation.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.teacherInvitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects binding a revoked code before usage or membership changes", async () => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue({ ...invitation, revokedAt: new Date() });
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(new TeacherInvitationsService(prisma).bind(studentAuth, { code: invitation.code })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });
});
