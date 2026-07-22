import { Body, ConflictException, Controller, ForbiddenException, NotFoundException, Post } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { createHash } from "node:crypto";
import { CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";

export class ResolveAssessmentLinkDto {
  @IsString()
  @MinLength(20)
  readonly token!: string;
}

@Controller("assessment-links")
export class AssessmentLinkController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("resolve")
  @RequireRoles(MembershipRole.STUDENT)
  async resolve(
    @Body() dto: ResolveAssessmentLinkDto,
    @CurrentPrincipal() principal: Principal,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const tokenHash = createHash("sha256").update(dto.token).digest("hex");
    const link = await this.prisma.assessmentLink.findUnique({
      where: { tokenHash },
      select: { id: true, schoolId: true, assessmentKey: true, title: true, targetType: true, targetId: true, status: true, expiresAt: true, maxUses: true, usedCount: true },
    });
    if (!link) throw new NotFoundException("测评链接不存在或已失效");
    if (tenant.schoolId && tenant.schoolId !== link.schoolId) {
      await this.record(link.id, link.schoolId, "TENANT_MISMATCH");
      throw new ForbiddenException("当前学校无权使用此链接");
    }
    if (link.status !== "ACTIVE") {
      await this.record(link.id, link.schoolId, `STATUS_${link.status}`);
      throw new ConflictException("测评链接已撤销或已失效");
    }
    if (link.expiresAt <= new Date()) {
      await this.prisma.assessmentLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
      await this.record(link.id, link.schoolId, "EXPIRED");
      throw new ConflictException("测评链接已过期");
    }
    if (link.usedCount >= link.maxUses) {
      await this.record(link.id, link.schoolId, "USE_LIMIT_REACHED");
      throw new ConflictException("测评链接使用次数已达上限");
    }
    const enrollment = link.targetType === "STUDENT"
      ? await this.prisma.enrollment.findFirst({ where: { id: link.targetId, schoolId: link.schoolId, userId: principal.userId, role: "STUDENT", status: "ACTIVE" }, select: { id: true, classId: true } })
      : await this.prisma.enrollment.findFirst({ where: { classId: link.targetId, schoolId: link.schoolId, userId: principal.userId, role: "STUDENT", status: "ACTIVE" }, select: { id: true, classId: true } });
    if (!enrollment) {
      await this.record(link.id, link.schoolId, "TARGET_MISMATCH");
      throw new ForbiddenException("当前账号不在测评链接目标范围内");
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.assessmentLink.updateMany({ where: { id: link.id, status: "ACTIVE", usedCount: { lt: link.maxUses } }, data: { usedCount: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException("测评链接已被其他请求使用完");
      await tx.assessmentLinkAccess.create({ data: { linkId: link.id, schoolId: link.schoolId, outcome: "RESOLVED" } });
      return { enrollmentId: enrollment.id, classId: enrollment.classId };
    });
    return { linkId: link.id, schoolId: link.schoolId, assessmentKey: link.assessmentKey, title: link.title, targetType: link.targetType, expiresAt: link.expiresAt, ...result };
  }

  private async record(linkId: string, schoolId: string, outcome: string) {
    await this.prisma.assessmentLinkAccess.create({ data: { linkId, schoolId, outcome } });
  }
}
