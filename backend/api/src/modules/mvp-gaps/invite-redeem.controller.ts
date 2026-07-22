import { Body, ConflictException, Controller, Inject, Post } from "@nestjs/common";
import { IsEnum, IsString, Length } from "class-validator";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { MembershipRole, Public } from "../../common/security/index.js";
import { PASSWORD_VERIFIER, type PasswordVerifier } from "../identity/ports/index.js";

export class RedeemInviteDto {
  @IsString() @Length(4, 80) readonly code!: string;
  @IsString() @Length(1, 254) readonly identifier!: string;
  @IsString() @Length(6, 128) readonly password!: string;
  @IsEnum(MembershipRole) readonly role!: MembershipRole;
}

/** Public, one-time account onboarding using a school-issued invitation code. */
@Controller("auth/invitations")
export class InviteRedeemController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_VERIFIER) private readonly passwordVerifier: PasswordVerifier,
  ) {}

  @Public()
  @Post("redeem")
  async redeem(@Body() dto: RedeemInviteDto) {
    const code = dto.code.trim().toUpperCase();
    const identifier = dto.identifier.trim();
    if (!identifier) throw new ConflictException("账号不能为空");
    if (dto.role === MembershipRole.PLATFORM_ADMIN) throw new ConflictException("邀请码不能授予平台管理员");
    const passwordHash = await this.passwordVerifier.hash(dto.password);
    const result = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({ where: { code }, select: { id: true, schoolId: true, createdByUserId: true, maxUses: true, usedCount: true, expiresAt: true, revokedAt: true } });
      if (!invite) throw new ConflictException("邀请码无效");
      if (invite.revokedAt) throw new ConflictException("邀请码已撤销");
      if (invite.expiresAt <= new Date()) throw new ConflictException("邀请码已过期");
      if (invite.usedCount >= invite.maxUses) throw new ConflictException("邀请码使用次数已达上限");
      const existing = await tx.user.findUnique({ where: { loginIdentifier: identifier }, select: { id: true } });
      if (existing) throw new ConflictException("该账号已存在，请直接登录或联系学校管理员");
      const claimed = await tx.inviteCode.updateMany({ where: { id: invite.id, revokedAt: null, expiresAt: { gt: new Date() }, usedCount: { lt: invite.maxUses } }, data: { usedCount: { increment: 1 } } });
      if (claimed.count !== 1) throw new ConflictException("邀请码已被其他请求使用，请重新获取邀请码");
      const user = await tx.user.create({ data: { loginIdentifier: identifier, displayName: identifier, passwordHash, status: "ACTIVE", preferredLocale: "zh-CN" } });
      const membership = await tx.membership.create({ data: { schoolId: invite.schoolId, userId: user.id, role: dto.role, status: "ACTIVE" }, select: { id: true, schoolId: true, role: true, status: true } });
      await tx.notification.create({ data: { schoolId: invite.schoolId, recipientUserId: invite.createdByUserId, type: "SYSTEM", priority: "NORMAL", title: "邀请码已兑换", body: `${identifier} 已兑换你创建的邀请码并加入学校`, actionUrl: "/admin/users-roles", relatedEntityType: "InviteCode", relatedEntityId: invite.id } });
      return { userId: user.id, membership };
    });
    return { userId: result.userId, membership: result.membership, next: "LOGIN_REQUIRED" };
  }
}
