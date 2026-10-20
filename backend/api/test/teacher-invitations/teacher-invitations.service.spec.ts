import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, type DeeplyAllowMatchers, vi } from "vitest";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";
import { TeacherInvitationsService } from "../../src/modules/teacher-invitations/teacher-invitations.service.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";

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

function typedObjectContaining<T extends object>(sample: DeeplyAllowMatchers<T>): T {
  const matcher: unknown = expect.objectContaining(sample);
  return matcher as T;
}

function anyDate(): Date {
  const matcher: unknown = expect.any(Date);
  return matcher as Date;
}

function matchingString(pattern: RegExp): string {
  const matcher: unknown = expect.stringMatching(pattern);
  return matcher as string;
}

const studentAuth = createAuthContext(
  "request-student",
  {
    userId: studentId,
    roles: [MembershipRole.STUDENT],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  },
  { schoolId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
);

const teacherAuth = createAuthContext(
  "request-teacher",
  {
    userId: teacherId,
    roles: [MembershipRole.TEACHER],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  },
  { schoolId },
);

type TransactionClient = {
  teacherInvitation: {
    findUnique: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
  };
  enrollment: {
    findUnique: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  membership: { upsert: (args: unknown) => Promise<unknown> };
  auditLog: { create: (args: unknown) => Promise<unknown> };
};

function fixture() {
  const transactionClient = {
    teacherInvitation: {
      findUnique: vi.fn((): Promise<unknown> => Promise.resolve(invitation)),
      updateMany: vi.fn((): Promise<unknown> => Promise.resolve({ count: 1 })),
      create: vi.fn((): Promise<unknown> => Promise.resolve(invitation)),
      findMany: vi.fn((): Promise<unknown> => Promise.resolve([])),
    },
    enrollment: {
      findUnique: vi.fn((): Promise<unknown> => Promise.resolve(null)),
      findFirst: vi.fn((): Promise<unknown> => Promise.resolve(null)),
      upsert: vi.fn((): Promise<unknown> => Promise.resolve({ id: "enrollment" })),
    },
    membership: {
      upsert: vi.fn((): Promise<unknown> => Promise.resolve({ id: "membership" })),
    },
    auditLog: {
      create: vi.fn((): Promise<unknown> => Promise.resolve({ id: "audit" })),
    },
  };
  const prisma = {
    ...transactionClient,
    $transaction: vi.fn((callback: (tx: TransactionClient) => Promise<unknown>) =>
      callback(transactionClient),
    ),
  };
  return prisma;
}

describe("TeacherInvitationsService", () => {
  it("binds a student to the invitation school and class, consuming one use", async () => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue(invitation);
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.enrollment.findFirst.mockResolvedValue({ id: "teacher-enrollment" });
    prisma.teacherInvitation.updateMany.mockResolvedValue({ count: 1 });

    const result = await new TeacherInvitationsService(prisma as unknown as PrismaService).bind(studentAuth, { code: " tc-abcde-12345 " });

    expect(result).toMatchObject({ alreadyBound: false, schoolId, class: { id: classId } });
    expect(prisma.teacherInvitation.updateMany).toHaveBeenCalledWith(typedObjectContaining({
      where: typedObjectContaining({ id: invitation.id, usedCount: { lt: invitation.maxUses } }),
      data: { usedCount: { increment: 1 } },
    }));
    expect(prisma.membership.upsert).toHaveBeenCalledWith(typedObjectContaining({
      where: { schoolId_userId_role: { schoolId, userId: studentId, role: MembershipRole.STUDENT } },
      create: typedObjectContaining({ schoolId, userId: studentId, status: "ACTIVE" }),
    }));
    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(typedObjectContaining({
      where: { classId_userId_role: { classId, userId: studentId, role: MembershipRole.STUDENT } },
      create: typedObjectContaining({ schoolId, classId, userId: studentId, status: "ACTIVE" }),
    }));
  });

  it("is idempotent for an active student enrollment and does not consume another use", async () => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue(invitation);
    prisma.enrollment.findUnique.mockResolvedValue({ id: "existing", status: "ACTIVE" });

    const result = await new TeacherInvitationsService(prisma as unknown as PrismaService).bind(studentAuth, { code: invitation.code });

    expect(result.alreadyBound).toBe(true);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it("does not allow a teacher to create an invitation in another tenant", async () => {
    const prisma = fixture();
    const auth: AuthContext = createAuthContext(
      "request-create",
      {
        userId: teacherId,
        roles: [MembershipRole.TEACHER],
        membershipStatus: MembershipStatus.ACTIVE,
        source: "session",
      },
      { schoolId },
    );

    await expect(new TeacherInvitationsService(prisma as unknown as PrismaService).create(auth, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { classId })).rejects.toBeInstanceOf(ForbiddenException);
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

    const result = await new TeacherInvitationsService(prisma as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id);

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
        expiresAt: { gt: anyDate() },
        usedCount: { lt: invitation.maxUses },
      },
      data: { revokedAt: anyDate() },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: typedObjectContaining({
        actorUserId: teacherId,
        schoolId,
        action: "TEACHER_INVITATION_REVOKED",
        resourceType: "TeacherInvitation",
        resourceId: invitation.id,
        requestId: teacherAuth.requestId,
        afterSummary: typedObjectContaining({
          invitationId: invitation.id,
          classId,
          revokedAt: matchingString(/^\d{4}-\d\d-\d\dT.*Z$/),
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

    const first = await new TeacherInvitationsService(prisma as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id);
    const second = await new TeacherInvitationsService(prisma as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id);

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

    const result = await new TeacherInvitationsService(prisma as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id);

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

    await expect(new TeacherInvitationsService(prisma as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing invitation and 403 for non-owner or inactive-class teachers", async () => {
    const missing = fixture();
    missing.teacherInvitation.findUnique.mockResolvedValue(null);
    await expect(new TeacherInvitationsService(missing as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(NotFoundException);

    const otherTeacher = fixture();
    otherTeacher.teacherInvitation.findUnique.mockResolvedValue({ ...invitation, teacherUserId: "66666666-6666-4666-8666-666666666666" });
    await expect(new TeacherInvitationsService(otherTeacher as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(otherTeacher.enrollment.findFirst).not.toHaveBeenCalled();

    const inactiveTeacher = fixture();
    inactiveTeacher.teacherInvitation.findUnique.mockResolvedValue(invitation);
    inactiveTeacher.enrollment.findFirst.mockResolvedValue(null);
    await expect(new TeacherInvitationsService(inactiveTeacher as unknown as PrismaService).revoke(teacherAuth, schoolId, invitation.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(inactiveTeacher.teacherInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a tenant mismatch before reading invitation data", async () => {
    const prisma = fixture();
    const crossSchoolTeacher = { ...teacherAuth, tenant: { schoolId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } };

    await expect(new TeacherInvitationsService(prisma as unknown as PrismaService).revoke(crossSchoolTeacher, schoolId, invitation.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.teacherInvitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects binding a revoked code before usage or membership changes", async () => {
    const prisma = fixture();
    prisma.teacherInvitation.findUnique.mockResolvedValue({ ...invitation, revokedAt: new Date() });
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(new TeacherInvitationsService(prisma as unknown as PrismaService).bind(studentAuth, { code: invitation.code })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.teacherInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });
});
