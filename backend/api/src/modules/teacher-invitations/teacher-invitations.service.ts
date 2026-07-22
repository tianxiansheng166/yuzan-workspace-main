import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { Prisma } from "@yuzan/database";

type InvitationInput = { classId: string; maxUses?: number; expiresInDays?: number };

@Injectable()
export class TeacherInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AuthContext, schoolId: string, input: InvitationInput) {
    this.assertTeacherScope(auth, schoolId);
    const teacher = await this.prisma.enrollment.findFirst({
      where: {
        schoolId,
        classId: input.classId,
        userId: auth.principal.userId,
        role: MembershipRole.TEACHER,
        status: "ACTIVE",
      },
      select: { class: { select: { id: true, name: true, grade: true } } },
    });
    if (!teacher) throw new ForbiddenException("只能为自己当前任教的班级创建邀请码");

    const invitation = await this.prisma.teacherInvitation.create({
      data: {
        schoolId,
        classId: input.classId,
        teacherUserId: auth.principal.userId,
        code: await this.nextCode(),
        maxUses: input.maxUses ?? 30,
        expiresAt: new Date(Date.now() + (input.expiresInDays ?? 30) * 24 * 60 * 60 * 1000),
      },
    });
    await this.audit(auth.principal.userId, schoolId, "TEACHER_INVITATION_CREATED", invitation.id, {
      classId: input.classId,
      maxUses: invitation.maxUses,
      expiresAt: invitation.expiresAt.toISOString(),
    });
    return this.toTeacherResponse(invitation, teacher.class);
  }

  async listMine(auth: AuthContext, schoolId: string) {
    this.assertTeacherScope(auth, schoolId);
    const invitations = await this.prisma.teacherInvitation.findMany({
      where: { schoolId, teacherUserId: auth.principal.userId },
      include: { class: { select: { id: true, name: true, grade: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items: invitations.map((invitation) => this.toTeacherResponse(invitation, invitation.class)) };
  }

  async bind(auth: AuthContext, dto: { code: string }) {
    if (!auth.principal.roles.includes(MembershipRole.STUDENT)) {
      throw new ForbiddenException("只有学生可以绑定教师邀请码");
    }
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, "");
    const invitation = await this.prisma.teacherInvitation.findUnique({
      where: { code },
      include: { class: { select: { id: true, name: true, grade: true } } },
    });
    if (!invitation) throw new NotFoundException("教师邀请码无效");

    const existing = await this.prisma.enrollment.findUnique({
      where: { classId_userId_role: { classId: invitation.classId, userId: auth.principal.userId, role: MembershipRole.STUDENT } },
      select: { id: true, status: true },
    });
    if (existing?.status === "ACTIVE") {
      return this.bindResponse(invitation, invitation.class, true);
    }

    const now = new Date();
    if (invitation.revokedAt) throw new ConflictException("该教师邀请码已撤销");
    if (invitation.expiresAt <= now) throw new ConflictException("该教师邀请码已过期");
    if (invitation.usedCount >= invitation.maxUses) throw new ConflictException("该教师邀请码使用次数已达上限");

    const teacherIsActive = await this.prisma.enrollment.findFirst({
      where: {
        schoolId: invitation.schoolId,
        classId: invitation.classId,
        userId: invitation.teacherUserId,
        role: MembershipRole.TEACHER,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!teacherIsActive) throw new ConflictException("该邀请码所属教师当前不在目标班级，请联系教师重新生成邀请码");

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.enrollment.findUnique({
        where: { classId_userId_role: { classId: invitation.classId, userId: auth.principal.userId, role: MembershipRole.STUDENT } },
        select: { id: true, status: true },
      });
      if (current?.status === "ACTIVE") return { alreadyBound: true };

      const claimed = await tx.teacherInvitation.updateMany({
        where: {
          id: invitation.id,
          revokedAt: null,
          expiresAt: { gt: now },
          usedCount: { lt: invitation.maxUses },
        },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new ConflictException("邀请码已失效或使用次数已满，请联系教师获取新邀请码");

      await tx.membership.upsert({
        where: { schoolId_userId_role: { schoolId: invitation.schoolId, userId: auth.principal.userId, role: MembershipRole.STUDENT } },
        update: { status: "ACTIVE" },
        create: { schoolId: invitation.schoolId, userId: auth.principal.userId, role: MembershipRole.STUDENT, status: "ACTIVE" },
      });
      await tx.enrollment.upsert({
        where: { classId_userId_role: { classId: invitation.classId, userId: auth.principal.userId, role: MembershipRole.STUDENT } },
        update: { status: "ACTIVE" },
        create: { schoolId: invitation.schoolId, classId: invitation.classId, userId: auth.principal.userId, role: MembershipRole.STUDENT, status: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: auth.principal.userId,
          schoolId: invitation.schoolId,
          action: "STUDENT_BOUND_TEACHER_INVITATION",
          resourceType: "TeacherInvitation",
          resourceId: invitation.id,
          requestId: "student-teacher-invitation-bind",
          afterSummary: { classId: invitation.classId, teacherUserId: invitation.teacherUserId },
        },
      });
      return { alreadyBound: false };
    });
    return this.bindResponse(invitation, invitation.class, result.alreadyBound);
  }

  private bindResponse(invitation: { schoolId: string; classId: string; teacherUserId: string }, classItem: { id: string; name: string; grade: string }, alreadyBound: boolean) {
    return {
      alreadyBound,
      schoolId: invitation.schoolId,
      class: { id: classItem.id, name: classItem.name, grade: classItem.grade },
      teacherUserId: invitation.teacherUserId,
      message: alreadyBound ? "你已在该教师班级中" : "已加入教师班级，现在可以进入练习中心",
    };
  }

  private toTeacherResponse(invitation: { id: string; code: string; maxUses: number; usedCount: number; expiresAt: Date; revokedAt: Date | null; createdAt: Date }, classItem: { id: string; name: string; grade: string }) {
    const now = new Date();
    const status = invitation.revokedAt ? "REVOKED" : invitation.expiresAt <= now ? "EXPIRED" : invitation.usedCount >= invitation.maxUses ? "EXHAUSTED" : "ACTIVE";
    return {
      id: invitation.id,
      code: invitation.code,
      class: classItem,
      maxUses: invitation.maxUses,
      usedCount: invitation.usedCount,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      status,
    };
  }

  private assertTeacherScope(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.includes(MembershipRole.TEACHER)) {
      throw new ForbiddenException("无权管理该学校的教师邀请码");
    }
  }

  private async nextCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const bytes = randomBytes(5).toString("hex").toUpperCase();
      const code = `TC-${bytes.slice(0, 5)}-${bytes.slice(5)}`;
      const exists = await this.prisma.teacherInvitation.findUnique({ where: { code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new ConflictException("邀请码生成失败，请重试");
  }

  private async audit(actorUserId: string, schoolId: string, action: string, resourceId: string, afterSummary: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { actorUserId, schoolId, action, resourceType: "TeacherInvitation", resourceId, requestId: "teacher-invitation", afterSummary: afterSummary as Prisma.InputJsonValue },
    });
  }
}
