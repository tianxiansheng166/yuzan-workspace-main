import {
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Body,
  Optional,
} from "@nestjs/common";
import {
  IsDateString,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  ValidateNested,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@yuzan/database";
import {
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  MembershipStatus,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { STORAGE_PORT, type StoragePort } from "../../shared/storage/storage.port.js";
import type { CourseVersionStatus } from "../curriculum/domain/course-version.types.js";

export class CreateSchoolDto {
  @IsString()
  @MinLength(2)
  readonly name!: string;

  @IsString()
  @MinLength(2)
  readonly code!: string;

  @IsOptional()
  @IsString()
  readonly timezone?: string;

  @IsOptional()
  @IsString()
  readonly regionCode?: string;
}

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  readonly name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  readonly code?: string;

  @IsOptional()
  @IsString()
  readonly timezone?: string;

  @IsOptional()
  @IsString()
  readonly regionCode?: string;

  @IsOptional()
  readonly isActive?: boolean;
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  readonly search?: string;

  @IsOptional()
  @IsEnum(MembershipRole)
  readonly role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  readonly status?: MembershipStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ArrayMaxSize(100)
  readonly limit = 50;
}

export class ListSchoolsQueryDto {
  @IsOptional()
  @IsString()
  readonly search?: string;

  @IsOptional()
  @IsString()
  readonly regionCode?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  readonly isActive?: "true" | "false";

  @IsOptional()
  @IsInt()
  @Min(1)
  @ArrayMaxSize(100)
  readonly limit = 50;
}

export class SchoolImportRowDto {
  @IsString() @MinLength(2) readonly name!: string;
  @IsString() @MinLength(2) readonly code!: string;
  @IsOptional() @IsString() readonly timezone?: string;
  @IsOptional() @IsString() readonly regionCode?: string;
}

export class SchoolImportDto {
  @IsString() @MinLength(16) readonly fileHash!: string;
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => SchoolImportRowDto) readonly rows!: SchoolImportRowDto[];
  @IsOptional() @IsBoolean() readonly async?: boolean;
}

export class CreateAssessmentLinkDto {
  @IsUUID() readonly schoolId!: string;
  @IsString() @MinLength(1) readonly assessmentKey!: string;
  @IsString() @MinLength(1) readonly title!: string;
  @IsIn(["CLASS", "STUDENT"]) readonly targetType!: "CLASS" | "STUDENT";
  @IsString() @MinLength(1) readonly targetId!: string;
  @IsDateString() readonly expiresAt!: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) readonly maxUses?: number;
}

export class InviteUserDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  readonly maxUses = 1;

  @IsDateString()
  readonly expiresAt!: string;
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  readonly role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  readonly status?: MembershipStatus;
}

export class ContentReviewQueryDto {
  @IsOptional()
  @IsString()
  readonly search?: string;

  @IsOptional()
  @IsIn(["IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"])
  readonly status = "IN_REVIEW";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;
}

export class AdminCurriculumQueryDto {
  @IsOptional()
  @IsString()
  readonly search?: string;

  @IsOptional()
  @IsIn(["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "RETIRED"])
  readonly status?: CourseVersionStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;
}

export class UpdateAdminCurriculumDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  readonly title?: string;

  @IsOptional()
  @IsString()
  readonly description?: string;

  @IsOptional()
  @IsString()
  readonly gradeBand?: string;

  @IsOptional()
  @IsObject()
  readonly objectives?: Record<string, unknown>;

  @IsDateString()
  readonly expectedUpdatedAt!: string;
}

export class AdminAssignmentTargetDto {
  @IsIn(["CLASS", "STUDENT"])
  readonly targetType!: "CLASS" | "STUDENT";

  @IsOptional()
  @IsUUID()
  readonly classId?: string;

  @IsOptional()
  @IsUUID()
  readonly enrollmentId?: string;
}

export class AdminCreateAssignmentDto {
  @IsString()
  @MinLength(2)
  readonly title!: string;

  @IsDateString()
  readonly startsAt!: string;

  @IsDateString()
  readonly dueAt!: string;

  @IsOptional()
  @IsBoolean()
  readonly offlineRequired?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminAssignmentTargetDto)
  readonly targets!: AdminAssignmentTargetDto[];
}

export class UpdateAdminActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  readonly title?: string;

  @IsOptional()
  @IsBoolean()
  readonly required?: boolean;

  @IsOptional()
  @IsObject()
  readonly instruction?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  readonly content?: Record<string, unknown>;
}

export class UpdateAdminQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  readonly kind?: string;

  @IsOptional()
  @IsObject()
  readonly prompt?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  readonly answerKey?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  readonly explanation?: Record<string, unknown>;
}

export class CreateAdminActivityDto {
  @IsUUID()
  readonly lessonId!: string;

  @IsIn(["TEXT", "VIDEO", "AUDIO", "CHOICE", "FILL_BLANK", "SPEECH"])
  readonly type!: "TEXT" | "VIDEO" | "AUDIO" | "CHOICE" | "FILL_BLANK" | "SPEECH";

  @IsString()
  @MinLength(1)
  readonly title!: string;

  @IsInt()
  @Min(0)
  readonly sortOrder!: number;

  @IsOptional()
  @IsBoolean()
  readonly required?: boolean;

  @IsOptional()
  @IsObject()
  readonly instruction?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  readonly content?: Record<string, unknown>;
}

export class CreateAdminQuestionDto {
  @IsString()
  @MinLength(1)
  readonly kind!: string;

  @IsObject()
  readonly prompt!: Record<string, unknown>;

  @IsObject()
  readonly answerKey!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  readonly explanation?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  readonly sortOrder!: number;
}

export class ReorderAdminContentDto {
  @IsInt()
  @Min(0)
  readonly sortOrder!: number;
}

export class CreatePrivacyRequestDto {
  @IsUUID()
  readonly subjectUserId!: string;

  @IsIn(["EXPORT", "DELETE", "FREEZE"])
  readonly type!: "EXPORT" | "DELETE" | "FREEZE";

  @IsOptional()
  @IsString()
  @MinLength(3)
  readonly reason?: string;
}

export class PrivacyRequestDecisionDto {
  @IsIn(["APPROVE", "REJECT", "COMPLETE"])
  readonly decision!: "APPROVE" | "REJECT" | "COMPLETE";

  @IsOptional()
  @IsString()
  readonly comment?: string;
}

export class PrivacyRequestQueryDto {
  @IsOptional()
  @IsIn(["EXPORT", "DELETE", "FREEZE"])
  readonly type?: "EXPORT" | "DELETE" | "FREEZE";

  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"])
  readonly status?: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;
}

export class ProductPlanQueryDto {
  @IsOptional() @IsIn(["DRAFT", "ACTIVE", "RETIRED"]) readonly status?: "DRAFT" | "ACTIVE" | "RETIRED";
  @IsOptional() @IsInt() @Min(1) @Max(100) readonly limit = 50;
}

export class PlanEntitlementDto {
  @IsString() @MinLength(1) readonly key!: string;
  @IsOptional() @IsBoolean() readonly enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) readonly limitValue?: number;
  @IsOptional() @IsObject() readonly config?: Record<string, unknown>;
}

export class CreateProductPlanDto {
  @IsString() @MinLength(1) readonly code!: string;
  @IsString() @MinLength(1) readonly name!: string;
  @IsOptional() @IsInt() @Min(0) readonly priceCents?: number;
  @IsOptional() @IsString() readonly currency?: string;
  @IsOptional() @IsInt() @Min(0) readonly trialDays?: number;
  @IsOptional() @IsObject() readonly metadata?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => PlanEntitlementDto) readonly entitlements?: PlanEntitlementDto[];
}

export class UpdateProductPlanDto {
  @IsOptional() @IsString() @MinLength(1) readonly name?: string;
  @IsOptional() @IsIn(["DRAFT", "ACTIVE", "RETIRED"]) readonly status?: "DRAFT" | "ACTIVE" | "RETIRED";
  @IsOptional() @IsInt() @Min(0) readonly priceCents?: number;
  @IsOptional() @IsString() readonly currency?: string;
  @IsOptional() @IsInt() @Min(0) readonly trialDays?: number;
  @IsOptional() @IsObject() readonly metadata?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => PlanEntitlementDto) readonly entitlements?: PlanEntitlementDto[];
}

export class CreateSubscriptionDto {
  @IsUUID() readonly planId!: string;
  @IsDateString() readonly startsAt!: string;
  @IsOptional() @IsDateString() readonly endsAt?: string;
  @IsOptional() @IsBoolean() readonly autoRenew?: boolean;
  @IsOptional() @IsString() readonly externalRef?: string;
  @IsOptional() @IsIn(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"]) readonly status?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsIn(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"]) readonly status?: string;
  @IsOptional() @IsDateString() readonly endsAt?: string;
  @IsOptional() @IsBoolean() readonly autoRenew?: boolean;
}

export class RenewSubscriptionDto {
  @IsInt() @Min(1) @Max(3650) readonly days!: number;
  @IsOptional() @IsString() readonly reason?: string;
}

export class QuotaUsageEventDto {
  @IsString() @MinLength(1) readonly entitlementKey!: string;
  @IsInt() @Min(0) readonly amount!: number;
  @IsString() @MinLength(1) readonly idempotencyKey!: string;
  @IsOptional() @IsString() readonly sourceType?: string;
  @IsOptional() @IsString() readonly sourceId?: string;
  @IsOptional() @IsObject() readonly metadata?: Record<string, unknown>;
}

export class CreateDataPolicyDto {
  @IsString() @MinLength(1) readonly name!: string;
  @IsInt() @Min(1) readonly version!: number;
  @IsString() @MinLength(1) readonly resourceType!: string;
  @IsInt() @Min(1) readonly retentionDays!: number;
  @IsOptional() @IsObject() readonly rules?: Record<string, unknown>;
}

export class RetentionJobDto {
  @IsUUID() readonly policyId!: string;
  @IsOptional() @IsUUID() readonly schoolId?: string;
  @IsOptional() @IsDateString() readonly cutoffAt?: string;
  @IsOptional() @IsBoolean() readonly dryRun?: boolean;
}

export class AdminActivityPatchDto {
  @IsUUID()
  readonly id!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  readonly title?: string;

  @IsOptional()
  @IsBoolean()
  readonly required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}

export class AdminQuestionPatchDto {
  @IsUUID()
  readonly id!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  readonly kind?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}

export class BatchAdminActivityUpdateDto {
  @IsArray()
  @Max(100)
  @ValidateNested({ each: true })
  @Type(() => AdminActivityPatchDto)
  readonly updates!: AdminActivityPatchDto[];
}

export class BatchAdminQuestionUpdateDto {
  @IsArray()
  @Max(100)
  @ValidateNested({ each: true })
  @Type(() => AdminQuestionPatchDto)
  readonly updates!: AdminQuestionPatchDto[];
}

export class ContentReviewDecisionDto {
  @IsIn(["APPROVE", "RETURN", "SUPPLEMENT"])
  readonly decision!: "APPROVE" | "RETURN" | "SUPPLEMENT";

  @IsOptional()
  @IsString()
  readonly comment?: string;
}

@Controller("admin")
export class AdminStubController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Optional() @Inject(STORAGE_PORT) private readonly storage?: StoragePort) {}

  @Get("dashboard")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async dashboard(
    @CurrentPrincipal() principal: Principal,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const schoolWhere = schoolId ? { schoolId } : {};
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [schools, users, students, teachers, assessments, pendingReviews, pendingSubmissions, recentRegistrations, recentSubmissions] =
      await Promise.all([
        this.prisma.school.count({ where: { ...schoolWhere, isActive: true, deletedAt: null } }),
        this.prisma.membership.count({ where: { ...schoolWhere, status: "ACTIVE" } }),
        this.prisma.membership.count({ where: { ...schoolWhere, role: "STUDENT", status: "ACTIVE" } }),
        this.prisma.membership.count({ where: { ...schoolWhere, role: "TEACHER", status: "ACTIVE" } }),
        this.prisma.submission.count({ where: { ...schoolWhere, status: "ACCEPTED" } }),
        this.prisma.courseVersion.count({ where: { ...schoolWhere, status: "IN_REVIEW" } }),
        this.prisma.submission.count({ where: { ...schoolWhere, status: "NEEDS_REVIEW" } }),
        this.prisma.membership.count({ where: { ...schoolWhere, status: "ACTIVE", joinedAt: { gte: sevenDaysAgo } } }),
        this.prisma.submission.count({ where: { ...schoolWhere, createdAt: { gte: sevenDaysAgo } } }),
      ]);

    // 7-day trend data — group by day
    const [registrationTrend, submissionTrend] = await Promise.all([
      this.prisma.membership.groupBy({
        by: ["joinedAt"],
        where: { ...schoolWhere, status: "ACTIVE", joinedAt: { gte: sevenDaysAgo } },
        _count: true,
      }),
      this.prisma.submission.groupBy({
        by: ["createdAt"],
        where: { ...schoolWhere, createdAt: { gte: sevenDaysAgo } },
        _count: true,
      }),
    ]);

    // Build daily buckets for last 7 days
    const trendDays: Array<{ date: string; registrations: number; submissions: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dateStr = dayStart.toISOString().slice(0, 10);
      const regCount = registrationTrend
        .filter((r) => { const d = new Date(r.joinedAt); return d >= dayStart && d < dayEnd; })
        .reduce((sum, r) => sum + r._count, 0);
      const subCount = submissionTrend
        .filter((r) => { const d = new Date(r.createdAt); return d >= dayStart && d < dayEnd; })
        .reduce((sum, r) => sum + r._count, 0);
      trendDays.push({ date: dateStr, registrations: regCount, submissions: subCount });
    }

    return {
      scope: schoolId ? { schoolId } : { allSchools: true },
      metrics: { schools, users, students, teachers, completedAssessments: assessments, pendingReviews },
      pendingQueue: { pendingReviews, pendingSubmissions },
      trends: { period: "7d", daily: trendDays },
      recentActivity: { registrations: recentRegistrations, submissions: recentSubmissions, since: sevenDaysAgo.toISOString() },
      generatedAt: new Date().toISOString(),
    };
  }

  @Get("schools")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listSchools(@Query() query: ListSchoolsQueryDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const rows = await this.prisma.school.findMany({
      where: {
        ...(schoolId ? { id: schoolId } : {}),
        deletedAt: null,
        ...(query.search ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] } : {}),
        ...(query.regionCode ? { regionCode: query.regionCode } : {}),
        ...(query.isActive ? { isActive: query.isActive === "true" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      include: { _count: { select: { memberships: true, classes: true } } },
    });
    return { items: rows.map((row) => ({
      id: row.id, code: row.code, name: row.name, timezone: row.timezone,
      regionCode: row.regionCode, isActive: row.isActive, createdAt: row.createdAt,
      updatedAt: row.updatedAt, counts: row._count,
    })) };
  }

  @Get("privacy/policies")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listDataPolicies(@Query() query: ProductPlanQueryDto) {
    return { items: await this.prisma.dataPolicyVersion.findMany({ where: query.status ? { status: query.status as "DRAFT" | "ACTIVE" | "RETIRED" } : {}, orderBy: [{ resourceType: "asc" }, { version: "desc" }], take: query.limit, select: { id: true, name: true, version: true, resourceType: true, retentionDays: true, status: true, rules: true, createdByUserId: true, createdAt: true, updatedAt: true } }) };
  }

  @Post("privacy/policies")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async createDataPolicy(@Body() dto: CreateDataPolicyDto, @CurrentPrincipal() principal: Principal) {
    const existing = await this.prisma.dataPolicyVersion.findUnique({ where: { name_version: { name: dto.name.trim(), version: dto.version } }, select: { id: true } });
    if (existing) throw new ConflictException("同名同版本的数据保留策略已存在");
    const row = await this.prisma.dataPolicyVersion.create({ data: { name: dto.name.trim(), version: dto.version, resourceType: dto.resourceType.trim(), retentionDays: dto.retentionDays, ...(dto.rules !== undefined ? { rules: dto.rules as Prisma.InputJsonValue } : {}), createdByUserId: principal.userId }, select: { id: true, name: true, version: true, resourceType: true, retentionDays: true, status: true, rules: true, createdAt: true, updatedAt: true } });
    await this.audit(principal.userId, null, "ADMIN_DATA_POLICY_CREATED", "DataPolicyVersion", row.id, null, { resourceType: row.resourceType, retentionDays: row.retentionDays });
    return row;
  }

  @Post("privacy/policies/:id/activate")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async activateDataPolicy(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.dataPolicyVersion.findUnique({ where: { id }, select: { id: true, resourceType: true, status: true } });
    if (!before) throw new NotFoundException("数据保留策略不存在");
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.dataPolicyVersion.updateMany({ where: { resourceType: before.resourceType, status: "ACTIVE", NOT: { id } }, data: { status: "RETIRED" } });
      return tx.dataPolicyVersion.update({ where: { id }, data: { status: "ACTIVE" }, select: { id: true, name: true, version: true, resourceType: true, retentionDays: true, status: true, updatedAt: true } });
    });
    await this.audit(principal.userId, null, "ADMIN_DATA_POLICY_ACTIVATED", "DataPolicyVersion", id, { status: before.status }, { status: row.status, resourceType: row.resourceType });
    return row;
  }

  @Get("privacy/retention-jobs")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listRetentionJobs(@CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    return { items: await this.prisma.privacyRetentionJob.findMany({ where: schoolId ? { schoolId } : {}, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, policyId: true, schoolId: true, cutoffAt: true, status: true, dryRun: true, scannedCount: true, redactedCount: true, errorCode: true, startedAt: true, completedAt: true, createdAt: true } }), scope: schoolId ? { schoolId } : { allSchools: true } };
  }

  @Post("privacy/retention-jobs")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createRetentionJob(@Body() dto: RetentionJobDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const scopedSchoolId = this.scopeSchoolId(principal, tenant);
    if (scopedSchoolId && dto.schoolId && scopedSchoolId !== dto.schoolId) throw new ForbiddenException("不能为其他学校创建保留任务");
    const policy = await this.prisma.dataPolicyVersion.findFirst({ where: { id: dto.policyId, status: "ACTIVE" }, select: { id: true, retentionDays: true, resourceType: true } });
    if (!policy) throw new ConflictException("只能使用已启用的数据保留策略");
    const schoolId = scopedSchoolId ?? dto.schoolId ?? null;
    if (dto.schoolId && !(await this.prisma.school.findFirst({ where: { id: dto.schoolId, deletedAt: null }, select: { id: true } }))) throw new NotFoundException("学校不存在");
    const cutoffAt = dto.cutoffAt ? new Date(dto.cutoffAt) : new Date(Date.now() - policy.retentionDays * 86400000);
    const row = await this.prisma.privacyRetentionJob.create({ data: { policyId: policy.id, ...(schoolId ? { schoolId } : {}), cutoffAt, dryRun: dto.dryRun ?? true, createdByUserId: principal.userId }, select: { id: true, policyId: true, schoolId: true, cutoffAt: true, status: true, dryRun: true, createdAt: true } });
    await this.audit(principal.userId, schoolId, "ADMIN_RETENTION_JOB_CREATED", "PrivacyRetentionJob", row.id, null, { policyId: policy.id, resourceType: policy.resourceType, cutoffAt: row.cutoffAt, dryRun: row.dryRun });
    return row;
  }

  @Post("privacy/retention-jobs/:id/run")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async runRetentionJob(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.privacyRetentionJob.findUnique({ where: { id }, select: { id: true, policyId: true, schoolId: true, cutoffAt: true, status: true, dryRun: true } });
    if (!before) throw new NotFoundException("保留任务不存在");
    if (before.status !== "QUEUED") throw new ConflictException(`当前任务状态为 ${before.status}，不可重复运行`);
    const candidates = await this.prisma.recording.findMany({ where: { ...(before.schoolId ? { schoolId: before.schoolId } : {}), createdAt: { lt: before.cutoffAt }, objectKey: { not: null } }, select: { id: true, objectKey: true, chunks: { select: { objectKey: true } } } });
    if (before.dryRun) {
      const row = await this.prisma.privacyRetentionJob.update({ where: { id }, data: { status: "COMPLETED", startedAt: new Date(), completedAt: new Date(), scannedCount: candidates.length, redactedCount: 0 }, select: { id: true, policyId: true, schoolId: true, cutoffAt: true, status: true, dryRun: true, scannedCount: true, redactedCount: true, startedAt: true, completedAt: true } });
      await this.audit(principal.userId, row.schoolId, "ADMIN_RETENTION_JOB_PREVIEWED", "PrivacyRetentionJob", id, { status: before.status }, { status: row.status, scannedCount: row.scannedCount, redactedCount: 0 });
      return { ...row, execution: "DRY_RUN_ONLY" };
    }
    if (!this.storage) throw new ConflictException("对象存储执行器未配置，无法运行实际留存删除");
    try {
      const allKeys = candidates.flatMap((recording) => [recording.objectKey, ...recording.chunks.map((chunk) => chunk.objectKey)]).filter((key): key is string => Boolean(key));
      const keys = [...new Set(allKeys)];
      for (const key of keys) await this.storage.deleteObject(key);
      const row = await this.prisma.privacyRetentionJob.update({ where: { id }, data: { status: "COMPLETED", startedAt: new Date(), completedAt: new Date(), scannedCount: candidates.length, redactedCount: candidates.length }, select: { id: true, policyId: true, schoolId: true, cutoffAt: true, status: true, dryRun: true, scannedCount: true, redactedCount: true, startedAt: true, completedAt: true } });
      await this.audit(principal.userId, row.schoolId, "ADMIN_RETENTION_JOB_EXECUTED", "PrivacyRetentionJob", id, { status: before.status }, { status: row.status, scannedCount: row.scannedCount, redactedCount: row.redactedCount, objectKeysDeleted: keys.length });
      return { ...row, execution: "OBJECTS_DELETED_METADATA_RETAINED" };
    } catch (error) {
      await this.prisma.privacyRetentionJob.update({ where: { id }, data: { status: "FAILED", errorCode: error instanceof Error && "code" in error ? String((error as Error & { code?: unknown }).code) : "STORAGE_DELETE_FAILED", completedAt: new Date() } });
      throw new ConflictException("对象存储删除失败，任务已标记失败，数据库证据未删除");
    }
  }

  @Get("assessment-links")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listAssessmentLinks(@CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const rows = await this.prisma.assessmentLink.findMany({ where: schoolId ? { schoolId } : {}, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, schoolId: true, assessmentKey: true, title: true, targetType: true, targetId: true, tokenPreview: true, status: true, expiresAt: true, maxUses: true, usedCount: true, createdByUserId: true, revokedAt: true, createdAt: true, _count: { select: { accesses: true } } } });
    return { items: rows.map((row) => ({ ...row, expired: row.expiresAt <= new Date() || row.status === "EXPIRED" })), scope: schoolId ? { schoolId } : { allSchools: true } };
  }

  @Post("assessment-links")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createAssessmentLink(@Body() dto: CreateAssessmentLinkDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    this.assertScopedSchool(principal, tenant, dto.schoolId);
    const school = await this.prisma.school.findFirst({ where: { id: dto.schoolId, deletedAt: null }, select: { id: true } });
    if (!school) throw new NotFoundException("学校不存在");
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) throw new ConflictException("链接过期时间必须晚于当前时间");
    if (dto.targetType === "CLASS") {
      const target = await this.prisma.class.findFirst({ where: { id: dto.targetId, schoolId: dto.schoolId }, select: { id: true } });
      if (!target) throw new NotFoundException("目标班级不存在或不属于当前学校");
    } else {
      const target = await this.prisma.enrollment.findFirst({ where: { id: dto.targetId, schoolId: dto.schoolId, role: "STUDENT", status: "ACTIVE" }, select: { id: true } });
      if (!target) throw new NotFoundException("目标学生报名关系不存在或已停用");
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const row = await this.prisma.assessmentLink.create({ data: { schoolId: dto.schoolId, assessmentKey: dto.assessmentKey.trim(), title: dto.title.trim(), targetType: dto.targetType, targetId: dto.targetId, tokenHash, tokenPreview: token.slice(0, 8), expiresAt, maxUses: dto.maxUses ?? 1, createdByUserId: principal.userId }, select: { id: true, schoolId: true, assessmentKey: true, title: true, targetType: true, targetId: true, tokenPreview: true, status: true, expiresAt: true, maxUses: true, usedCount: true, createdAt: true } });
    await this.audit(principal.userId, dto.schoolId, "ADMIN_ASSESSMENT_LINK_CREATED", "AssessmentLink", row.id, null, { assessmentKey: row.assessmentKey, targetType: row.targetType, targetId: row.targetId, expiresAt: row.expiresAt });
    return { ...row, token, urlPath: `/assessment/link/${token}` };
  }

  @Post("assessment-links/:id/revoke")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async revokeAssessmentLink(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const before = await this.prisma.assessmentLink.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, status: true } });
    if (!before) throw new NotFoundException("测评链接不存在或不在当前管理范围");
    if (before.status === "REVOKED") throw new ConflictException("链接已撤销");
    const row = await this.prisma.assessmentLink.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() }, select: { id: true, schoolId: true, status: true, revokedAt: true } });
    await this.audit(principal.userId, row.schoolId, "ADMIN_ASSESSMENT_LINK_REVOKED", "AssessmentLink", id, { status: before.status }, { status: row.status });
    return row;
  }

  @Get("assessment-links/:id/accesses")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listAssessmentLinkAccesses(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const link = await this.prisma.assessmentLink.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true } });
    if (!link) throw new NotFoundException("测评链接不存在或不在当前管理范围");
    return { items: await this.prisma.assessmentLinkAccess.findMany({ where: { linkId: id }, orderBy: { accessedAt: "desc" }, take: 100, select: { id: true, outcome: true, sessionId: true, accessedAt: true } }), scope: { schoolId: link.schoolId } };
  }

  @Get("product-plans")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listProductPlans(@Query() query: ProductPlanQueryDto, @CurrentPrincipal() principal: Principal) {
    const rows = await this.prisma.productPlan.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: query.limit,
      select: { id: true, code: true, name: true, version: true, status: true, priceCents: true, currency: true, trialDays: true, metadata: true, createdAt: true, updatedAt: true, entitlements: { select: { id: true, key: true, enabled: true, limitValue: true, config: true } } },
    });
    return { items: rows, scope: principal.roles.includes(MembershipRole.PLATFORM_ADMIN) ? { allSchools: true } : { currentSchoolOnly: true } };
  }

  @Post("product-plans")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async createProductPlan(@Body() dto: CreateProductPlanDto, @CurrentPrincipal() principal: Principal) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.productPlan.findUnique({ where: { code }, select: { id: true } });
    if (exists) throw new ConflictException("套餐编码已存在");
    const keys = dto.entitlements?.map((item) => item.key.trim()) ?? [];
    if (new Set(keys).size !== keys.length) throw new ConflictException("套餐权益键不能重复");
    const row = await this.prisma.productPlan.create({ data: { code, name: dto.name.trim(), priceCents: dto.priceCents ?? 0, currency: dto.currency ?? "CNY", trialDays: dto.trialDays ?? 0, ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}), createdByUserId: principal.userId, ...(dto.entitlements?.length ? { entitlements: { create: dto.entitlements.map((item) => ({ key: item.key.trim(), enabled: item.enabled ?? true, ...(item.limitValue !== undefined ? { limitValue: item.limitValue } : {}), ...(item.config !== undefined ? { config: item.config as Prisma.InputJsonValue } : {}) })) } } : {}) }, select: { id: true, code: true, name: true, version: true, status: true, priceCents: true, currency: true, trialDays: true, metadata: true, createdAt: true, updatedAt: true, entitlements: true } });
    await this.audit(principal.userId, null, "ADMIN_PRODUCT_PLAN_CREATED", "ProductPlan", row.id, null, { code: row.code, name: row.name });
    return row;
  }

  @Patch("product-plans/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async updateProductPlan(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProductPlanDto, @CurrentPrincipal() principal: Principal) {
    const existing = await this.prisma.productPlan.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundException("套餐不存在");
    if (existing.status === "RETIRED" && dto.status !== "RETIRED") throw new ConflictException("已退役套餐不可重新启用");
    const keys = dto.entitlements?.map((item) => item.key.trim()) ?? [];
    if (new Set(keys).size !== keys.length) throw new ConflictException("套餐权益键不能重复");
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.entitlements) {
        await tx.planEntitlement.deleteMany({ where: { planId: id } });
      }
      return tx.productPlan.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}), ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}), ...(dto.currency !== undefined ? { currency: dto.currency } : {}), ...(dto.trialDays !== undefined ? { trialDays: dto.trialDays } : {}), ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}), ...(dto.entitlements ? { entitlements: { create: dto.entitlements.map((item) => ({ key: item.key.trim(), enabled: item.enabled ?? true, ...(item.limitValue !== undefined ? { limitValue: item.limitValue } : {}), ...(item.config !== undefined ? { config: item.config as Prisma.InputJsonValue } : {}) })) } } : {}) }, select: { id: true, code: true, name: true, version: true, status: true, priceCents: true, currency: true, trialDays: true, metadata: true, createdAt: true, updatedAt: true, entitlements: true } });
    });
    await this.audit(principal.userId, null, "ADMIN_PRODUCT_PLAN_UPDATED", "ProductPlan", row.id, { status: existing.status }, { status: row.status });
    return row;
  }

  @Get("schools/:id/subscription")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async getSchoolSubscription(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    this.assertScopedSchool(principal, tenant, id);
    const row = await this.prisma.schoolSubscription.findFirst({ where: { schoolId: id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, select: { id: true, schoolId: true, planId: true, status: true, startsAt: true, endsAt: true, autoRenew: true, externalRef: true, createdAt: true, updatedAt: true, plan: { select: { code: true, name: true, version: true, entitlements: { select: { key: true, enabled: true, limitValue: true } } } } } });
    return row ?? { subscription: null };
  }

  @Get("schools/:id/quota-usage")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async getSchoolQuotaUsage(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    this.assertScopedSchool(principal, tenant, id);
    const subscription = await this.prisma.schoolSubscription.findFirst({ where: { schoolId: id, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, endsAt: true, plan: { select: { id: true, code: true, name: true, entitlements: { where: { enabled: true }, select: { key: true, limitValue: true, config: true } } } } } });
    if (!subscription) return { subscription: null, items: [] };
    const [students, teachers, submissions, recordings, usageEvents] = await Promise.all([
      this.prisma.membership.count({ where: { schoolId: id, role: "STUDENT", status: "ACTIVE" } }),
      this.prisma.membership.count({ where: { schoolId: id, role: "TEACHER", status: "ACTIVE" } }),
      this.prisma.submission.count({ where: { schoolId: id, deletedAt: null } }),
      this.prisma.recording.count({ where: { schoolId: id } }),
      this.prisma.subscriptionEvent.findMany({ where: { subscriptionId: subscription.id, type: "QUOTA_USAGE_RECORDED" }, orderBy: { createdAt: "asc" }, select: { id: true, payload: true, createdAt: true } }),
    ]);
    const usage: Record<string, number | null> = { students, teachers, submissions, recordings };
    const meteredUsage: Record<string, number> = {};
    for (const event of usageEvents) {
      const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
      const key = typeof payload.entitlementKey === "string" ? payload.entitlementKey : "";
      const amount = typeof payload.amount === "number" ? payload.amount : 0;
      if (key) meteredUsage[key] = (meteredUsage[key] ?? 0) + amount;
    }
    return { subscription: { id: subscription.id, status: subscription.status, endsAt: subscription.endsAt, plan: subscription.plan }, items: subscription.plan.entitlements.map((entitlement) => { const eventUsed = meteredUsage[entitlement.key]; const used = eventUsed !== undefined ? eventUsed : (usage[entitlement.key] ?? null); const limit = entitlement.limitValue ?? null; return { key: entitlement.key, used, limit, ...(eventUsed !== undefined ? { source: "METERED_EVENTS" } : {}), remaining: used !== null && limit !== null ? Math.max(limit - used, 0) : null, percent: used !== null && limit && limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : null }; }) };
  }

  @Post("schools/:id/quota-usage/events")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async recordQuotaUsageEvent(@Param("id", ParseUUIDPipe) id: string, @Body() dto: QuotaUsageEventDto, @CurrentPrincipal() principal: Principal) {
    const subscription = await this.prisma.schoolSubscription.findFirst({ where: { schoolId: id, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } }, orderBy: { createdAt: "desc" }, select: { id: true, plan: { select: { entitlements: { where: { key: dto.entitlementKey, enabled: true }, select: { key: true } } } } } });
    if (!subscription) throw new NotFoundException("学校没有可计量的有效订阅");
    if (!subscription.plan.entitlements.length) throw new ConflictException("套餐未启用该配额权益");
    const existing = await this.prisma.subscriptionEvent.findFirst({ where: { subscriptionId: subscription.id, type: "QUOTA_USAGE_RECORDED", payload: { path: ["idempotencyKey"], equals: dto.idempotencyKey } }, select: { id: true, payload: true, createdAt: true } });
    if (existing) return { idempotent: true, event: existing };
    const event = await this.prisma.subscriptionEvent.create({ data: { subscriptionId: subscription.id, type: "QUOTA_USAGE_RECORDED", actorUserId: principal.userId, payload: { entitlementKey: dto.entitlementKey, amount: dto.amount, idempotencyKey: dto.idempotencyKey, sourceType: dto.sourceType ?? null, sourceId: dto.sourceId ?? null, metadata: dto.metadata ?? null } as Prisma.InputJsonValue }, select: { id: true, subscriptionId: true, type: true, payload: true, createdAt: true } });
    await this.audit(principal.userId, id, "ADMIN_QUOTA_USAGE_RECORDED", "SubscriptionEvent", event.id, null, { entitlementKey: dto.entitlementKey, amount: dto.amount, idempotencyKey: dto.idempotencyKey });
    return { idempotent: false, event };
  }

  @Post("schools/:id/subscription")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async createSchoolSubscription(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateSubscriptionDto, @CurrentPrincipal() principal: Principal) {
    const [school, plan] = await Promise.all([this.prisma.school.findFirst({ where: { id, deletedAt: null }, select: { id: true } }), this.prisma.productPlan.findFirst({ where: { id: dto.planId, status: "ACTIVE" }, select: { id: true } })]);
    if (!school) throw new NotFoundException("学校不存在");
    if (!plan) throw new ConflictException("只能订阅已启用套餐");
    const startsAt = new Date(dto.startsAt); const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt <= startsAt) throw new ConflictException("订阅结束时间必须晚于开始时间");
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.schoolSubscription.updateMany({ where: { schoolId: id, status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } }, data: { status: "CANCELLED" } });
      const created = await tx.schoolSubscription.create({ data: { schoolId: id, planId: dto.planId, status: (dto.status ?? "TRIAL") as "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "EXPIRED" | "CANCELLED", startsAt, endsAt, autoRenew: dto.autoRenew ?? false, ...(dto.externalRef ? { externalRef: dto.externalRef } : {}), createdByUserId: principal.userId } });
      await tx.subscriptionEvent.create({ data: { subscriptionId: created.id, type: "CREATED", actorUserId: principal.userId, payload: { planId: dto.planId, status: created.status } as Prisma.InputJsonValue } });
      return created;
    });
    await this.audit(principal.userId, id, "ADMIN_SUBSCRIPTION_CREATED", "SchoolSubscription", row.id, null, { planId: row.planId, status: row.status });
    return row;
  }

  @Patch("subscriptions/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async updateSubscription(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSubscriptionDto, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.schoolSubscription.findUnique({ where: { id }, select: { id: true, schoolId: true, status: true, endsAt: true } });
    if (!before) throw new NotFoundException("订阅不存在");
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.schoolSubscription.update({ where: { id }, data: { ...(dto.status !== undefined ? { status: dto.status as "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "EXPIRED" | "CANCELLED" } : {}), ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}), ...(dto.autoRenew !== undefined ? { autoRenew: dto.autoRenew } : {}) } });
      await tx.subscriptionEvent.create({ data: { subscriptionId: id, type: "UPDATED", actorUserId: principal.userId, payload: { before: { status: before.status, endsAt: before.endsAt }, after: { status: updated.status, endsAt: updated.endsAt } } as Prisma.InputJsonValue } });
      return updated;
    });
    await this.audit(principal.userId, row.schoolId, "ADMIN_SUBSCRIPTION_UPDATED", "SchoolSubscription", id, { status: before.status }, { status: row.status });
    return row;
  }

  @Post("subscriptions/:id/renew")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async renewSubscription(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RenewSubscriptionDto, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.schoolSubscription.findUnique({ where: { id }, select: { id: true, schoolId: true, status: true, endsAt: true } });
    if (!before) throw new NotFoundException("订阅不存在");
    if (["CANCELLED", "EXPIRED"].includes(before.status)) throw new ConflictException("已取消或已过期订阅不能直接续期");
    const now = new Date();
    const base = before.endsAt && before.endsAt > now ? before.endsAt : now;
    const endsAt = new Date(base.getTime() + dto.days * 86400000);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.schoolSubscription.update({ where: { id }, data: { endsAt, status: "ACTIVE", autoRenew: false } });
      await tx.subscriptionEvent.create({ data: { subscriptionId: id, type: "RENEWED", actorUserId: principal.userId, payload: { days: dto.days, reason: dto.reason?.trim() || null, previousEndsAt: before.endsAt, endsAt } as Prisma.InputJsonValue } });
      return updated;
    });
    await this.audit(principal.userId, row.schoolId, "ADMIN_SUBSCRIPTION_RENEWED", "SchoolSubscription", id, { status: before.status, endsAt: before.endsAt }, { status: row.status, endsAt: row.endsAt, days: dto.days });
    return row;
  }

  @Get("schools/import-jobs")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async listSchoolImportJobs(@Query() query: ProductPlanQueryDto) {
    return { items: await this.prisma.schoolImportJob.findMany({ orderBy: { createdAt: "desc" }, take: query.limit, select: { id: true, fileHash: true, status: true, rowCount: true, successCount: true, errorCount: true, rowErrors: true, createdByUserId: true, createdAt: true, completedAt: true } }) };
  }

  @Post("schools/import")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async importSchools(@Body() dto: SchoolImportDto, @CurrentPrincipal() principal: Principal) {
    const fileHash = dto.fileHash.trim().toLowerCase();
    const duplicate = await this.prisma.schoolImportJob.findUnique({ where: { fileHash }, select: { id: true, status: true, rowCount: true, successCount: true, errorCount: true } });
    if (duplicate) return { idempotent: true, job: duplicate };
    const job = await this.prisma.schoolImportJob.create({ data: { fileHash, rowCount: dto.rows.length, createdByUserId: principal.userId, status: dto.async ? "QUEUED" : "PROCESSING", ...(dto.async ? { payload: dto.rows as unknown as Prisma.InputJsonValue } : {}) }, select: { id: true, fileHash: true, status: true, rowCount: true } });
    if (dto.async) {
      await this.audit(principal.userId, null, "ADMIN_SCHOOL_IMPORT_QUEUED", "SchoolImportJob", job.id, null, { rowCount: job.rowCount, fileHash });
      return { idempotent: false, queued: true, job };
    }
    const rowErrors: Array<{ row: number; code?: string; message: string }> = [];
    const seen = new Set<string>();
    const candidates: Array<{ code: string; name: string; timezone: string; regionCode?: string }> = [];
    for (const [index, input] of dto.rows.entries()) {
      const code = input.code.trim().toUpperCase();
      if (seen.has(code)) { rowErrors.push({ row: index + 1, code, message: "文件内编码重复" }); continue; }
      seen.add(code);
      if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(code)) { rowErrors.push({ row: index + 1, code, message: "编码格式无效" }); continue; }
      candidates.push({ code, name: input.name.trim(), timezone: input.timezone?.trim() || "Asia/Shanghai", ...(input.regionCode?.trim() ? { regionCode: input.regionCode.trim() } : {}) });
    }
    const existing = candidates.length ? await this.prisma.school.findMany({ where: { code: { in: candidates.map((item) => item.code) } }, select: { code: true } }) : [];
    const existingCodes = new Set(existing.map((item) => item.code));
    const valid = candidates.filter((item) => {
      if (!existingCodes.has(item.code)) return true;
      rowErrors.push({ code: item.code, row: dto.rows.findIndex((row) => row.code.trim().toUpperCase() === item.code) + 1, message: "学校编码已存在" });
      return false;
    });
    let inserted = 0;
    try {
      if (valid.length) inserted = (await this.prisma.school.createMany({ data: valid })).count;
      const result = await this.prisma.schoolImportJob.update({ where: { id: job.id }, data: { status: rowErrors.length ? (inserted ? "COMPLETED" : "FAILED") : "COMPLETED", successCount: inserted, errorCount: rowErrors.length, rowErrors: rowErrors as Prisma.InputJsonValue, completedAt: new Date() }, select: { id: true, fileHash: true, status: true, rowCount: true, successCount: true, errorCount: true, rowErrors: true, completedAt: true } });
      await this.audit(principal.userId, null, "ADMIN_SCHOOL_IMPORT_COMPLETED", "SchoolImportJob", job.id, { status: "PROCESSING" }, { status: result.status, successCount: inserted, errorCount: rowErrors.length });
      return { idempotent: false, job: result };
    } catch (error) {
      await this.prisma.schoolImportJob.update({ where: { id: job.id }, data: { status: "FAILED", errorCount: rowErrors.length + 1, rowErrors: [...rowErrors, { row: 0, message: "数据库写入失败" }] as Prisma.InputJsonValue, completedAt: new Date() } });
      throw error;
    }
  }

  @Post("schools/import-jobs/:id/run")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async runSchoolImportJob(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const job = await this.prisma.schoolImportJob.findUnique({ where: { id }, select: { id: true, fileHash: true, status: true, rowCount: true, payload: true } });
    if (!job) throw new NotFoundException("导入任务不存在");
    if (job.status !== "QUEUED") throw new ConflictException(`当前任务状态为 ${job.status}，不可运行`);
    if (!Array.isArray(job.payload)) throw new ConflictException("导入任务缺少待处理数据");
    const rows = job.payload as Array<{ name?: unknown; code?: unknown; timezone?: unknown; regionCode?: unknown }>;
    await this.prisma.schoolImportJob.update({ where: { id }, data: { status: "PROCESSING", payload: Prisma.JsonNull } });
    const rowErrors: Array<{ row: number; code?: string; message: string }> = [];
    const seen = new Set<string>();
    const candidates: Array<{ code: string; name: string; timezone: string; regionCode?: string }> = [];
    for (const [index, input] of rows.entries()) {
      const code = String(input.code ?? "").trim().toUpperCase();
      const name = String(input.name ?? "").trim();
      if (seen.has(code)) { rowErrors.push({ row: index + 1, code, message: "文件内编码重复" }); continue; }
      seen.add(code);
      if (!name || !/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(code)) { rowErrors.push({ row: index + 1, code, message: !name ? "学校名称不能为空" : "编码格式无效" }); continue; }
      candidates.push({ code, name, timezone: String(input.timezone ?? "Asia/Shanghai").trim() || "Asia/Shanghai", ...(String(input.regionCode ?? "").trim() ? { regionCode: String(input.regionCode).trim() } : {}) });
    }
    try {
      const existing = candidates.length ? await this.prisma.school.findMany({ where: { code: { in: candidates.map((item) => item.code) } }, select: { code: true } }) : [];
      const existingCodes = new Set(existing.map((item) => item.code));
      const valid = candidates.filter((item) => {
        if (!existingCodes.has(item.code)) return true;
        rowErrors.push({ code: item.code, row: rows.findIndex((row) => String(row.code ?? "").trim().toUpperCase() === item.code) + 1, message: "学校编码已存在" });
        return false;
      });
      const inserted = valid.length ? (await this.prisma.school.createMany({ data: valid })).count : 0;
      const result = await this.prisma.schoolImportJob.update({ where: { id }, data: { status: rowErrors.length && !inserted ? "FAILED" : "COMPLETED", successCount: inserted, errorCount: rowErrors.length, rowErrors: rowErrors as Prisma.InputJsonValue, completedAt: new Date() }, select: { id: true, fileHash: true, status: true, rowCount: true, successCount: true, errorCount: true, rowErrors: true, completedAt: true } });
      await this.audit(principal.userId, null, "ADMIN_SCHOOL_IMPORT_COMPLETED", "SchoolImportJob", id, { status: "PROCESSING" }, { status: result.status, successCount: inserted, errorCount: rowErrors.length, async: true });
      return { idempotent: false, queued: false, job: result };
    } catch (error) {
      await this.prisma.schoolImportJob.update({ where: { id }, data: { status: "FAILED", errorCount: rowErrors.length + 1, rowErrors: [...rowErrors, { row: 0, message: "数据库写入失败" }] as Prisma.InputJsonValue, completedAt: new Date() } });
      throw error;
    }
  }

  @Post("schools")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async createSchool(@Body() dto: CreateSchoolDto, @CurrentPrincipal() principal: Principal) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.school.findUnique({ where: { code } });
    if (exists) throw new ConflictException("学校编码已存在");
    const row = await this.prisma.school.create({
      data: { code, name: dto.name.trim(), timezone: dto.timezone ?? "Asia/Shanghai", ...(dto.regionCode ? { regionCode: dto.regionCode.trim() } : {}) },
    });
    await this.audit(principal.userId, row.id, "ADMIN_SCHOOL_CREATED", "School", row.id, null, { code: row.code, name: row.name });
    return row;
  }

  @Get("schools/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async getSchool(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    this.assertScopedSchool(principal, tenant, id);
    const row = await this.prisma.school.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { memberships: true, classes: true, courses: true, assignments: true } } } });
    if (!row) throw new NotFoundException("学校不存在");
    return { id: row.id, code: row.code, name: row.name, timezone: row.timezone, regionCode: row.regionCode, isActive: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt, counts: row._count };
  }

  @Get("schools/:id/overview")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async schoolOverview(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    this.assertScopedSchool(principal, tenant, id);
    const school = await this.prisma.school.findFirst({ where: { id, deletedAt: null }, select: { id: true, code: true, name: true, timezone: true, regionCode: true, isActive: true, createdAt: true, updatedAt: true } });
    if (!school) throw new NotFoundException("学校不存在");
    const [members, students, teachers, volunteers, classes, courses, inReview, published, openAssignments, acceptedSubmissions, reviewSubmissions, recentAudit] = await Promise.all([
      this.prisma.membership.count({ where: { schoolId: id, status: "ACTIVE" } }),
      this.prisma.membership.count({ where: { schoolId: id, role: "STUDENT", status: "ACTIVE" } }),
      this.prisma.membership.count({ where: { schoolId: id, role: "TEACHER", status: "ACTIVE" } }),
      this.prisma.membership.count({ where: { schoolId: id, role: "VOLUNTEER", status: "ACTIVE" } }),
      this.prisma.class.count({ where: { schoolId: id } }),
      this.prisma.course.count({ where: { schoolId: id, deletedAt: null } }),
      this.prisma.courseVersion.count({ where: { schoolId: id, status: "IN_REVIEW" } }),
      this.prisma.courseVersion.count({ where: { schoolId: id, status: "PUBLISHED" } }),
      this.prisma.assignment.count({ where: { schoolId: id, status: "OPEN", deletedAt: null } }),
      this.prisma.submission.count({ where: { schoolId: id, status: "ACCEPTED" } }),
      this.prisma.submission.count({ where: { schoolId: id, status: "NEEDS_REVIEW" } }),
      this.prisma.auditLog.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, actorUserId: true, action: true, resourceType: true, resourceId: true, createdAt: true, afterSummary: true } }),
    ]);
    return { school, metrics: { members, students, teachers, volunteers, classes, courses, inReview, published, openAssignments, acceptedSubmissions, reviewSubmissions }, recentAudit };
  }

  @Get("curriculum")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listCurriculum(@Query() query: AdminCurriculumQueryDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const rows = await this.prisma.courseVersion.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { OR: [{ title: { contains: query.search } }, { course: { stableKey: { contains: query.search } } }] } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: query.limit,
      select: {
        id: true, schoolId: true, courseId: true, version: true, status: true, title: true,
        description: true, gradeBand: true, locale: true, submittedAt: true, approvedAt: true,
        publishedAt: true, updatedAt: true, course: { select: { stableKey: true } },
        _count: { select: { units: true, assignments: true, reviews: true } },
      },
    });
    return { items: rows, scope: schoolId ? { schoolId } : { allSchools: true } };
  }

  @Get("curriculum/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async getCurriculum(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const row = await this.prisma.courseVersion.findFirst({
      where: { id, ...(schoolId ? { schoolId } : {}) },
      select: {
        id: true, schoolId: true, courseId: true, version: true, status: true, title: true,
        description: true, gradeBand: true, locale: true, objectives: true, submittedAt: true,
        approvedAt: true, publishedAt: true, updatedAt: true, course: { select: { stableKey: true, title: true } },
        units: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, title: true, sortOrder: true,
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true, title: true, sortOrder: true,
                activities: {
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true, type: true, title: true, sortOrder: true, required: true,
                    questions: {
                      orderBy: { sortOrder: "asc" },
                      select: { id: true, kind: true, prompt: true, sortOrder: true },
                    },
                  },
                },
              },
            },
          },
        },
        assignments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, status: true, startsAt: true, dueAt: true, createdAt: true } },
        reviews: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, reviewerUserId: true, decision: true, comment: true, createdAt: true } },
      },
    });
    if (!row) throw new NotFoundException("课程版本不存在或不在当前管理范围");
    return row;
  }

  @Patch("curriculum/:versionId/activities/batch")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async batchUpdateCurriculumActivities(@Param("versionId", ParseUUIDPipe) versionId: string, @Body() dto: BatchAdminActivityUpdateDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    if (dto.updates.length === 0) throw new ConflictException("批量更新不能为空");
    const ids = dto.updates.map((update) => update.id);
    if (new Set(ids).size !== ids.length) throw new ConflictException("批量更新中不能重复指定活动");
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("课程版本不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const rows = await this.prisma.learningActivity.findMany({ where: { id: { in: ids }, lesson: { unit: { courseVersionId: versionId } } }, select: { id: true } });
    if (rows.length !== ids.length) throw new ForbiddenException("批量更新包含不属于当前课程版本的活动");
    const byId = new Map(dto.updates.map((update) => [update.id, update]));
    const result = await this.prisma.$transaction(async (tx) => {
      await Promise.all(ids.map((id, index) => tx.learningActivity.update({ where: { id }, data: { sortOrder: -1000000 - index } })));
      return Promise.all(ids.map((id) => { const update = byId.get(id)!; return tx.learningActivity.update({ where: { id }, data: { ...(update.title !== undefined ? { title: update.title.trim() } : {}), ...(update.required !== undefined ? { required: update.required } : {}), ...(update.sortOrder !== undefined ? { sortOrder: update.sortOrder } : {}) }, select: { id: true, title: true, required: true, sortOrder: true } }); }));
    });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_ACTIVITIES_BATCH_UPDATED", "LearningActivity", versionId, null, { count: result.length, ids });
    return { items: result };
  }

  @Patch("curriculum/:versionId/activities/:activityId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async updateCurriculumActivity(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @Body() dto: UpdateAdminActivityDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { id: activityId } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("活动不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const activity = await this.prisma.learningActivity.update({ where: { id: activityId }, data: {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.required !== undefined ? { required: dto.required } : {}),
      ...(dto.instruction !== undefined ? { instruction: dto.instruction as Prisma.InputJsonValue } : {}),
      ...(dto.content !== undefined ? { content: dto.content as Prisma.InputJsonValue } : {}),
    }, select: { id: true, lessonId: true, type: true, title: true, required: true, instruction: true, content: true, sortOrder: true } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_ACTIVITY_UPDATED", "LearningActivity", activityId, null, { versionId, title: activity.title });
    return activity;
  }

  @Post("curriculum/:versionId/activities")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createCurriculumActivity(@Param("versionId", ParseUUIDPipe) versionId: string, @Body() dto: CreateAdminActivityDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { id: dto.lessonId } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("课节不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const activity = await this.prisma.learningActivity.create({ data: {
      lessonId: dto.lessonId, type: dto.type, title: dto.title.trim(), sortOrder: dto.sortOrder, required: dto.required ?? true,
      ...(dto.instruction !== undefined ? { instruction: dto.instruction as Prisma.InputJsonValue } : {}),
      ...(dto.content !== undefined ? { content: dto.content as Prisma.InputJsonValue } : {}),
    }, select: { id: true, lessonId: true, type: true, title: true, required: true, instruction: true, content: true, sortOrder: true } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_ACTIVITY_CREATED", "LearningActivity", activity.id, null, { versionId, lessonId: dto.lessonId });
    return activity;
  }

  @Patch("curriculum/:versionId/activities/:activityId/reorder")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async reorderCurriculumActivity(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @Body() dto: ReorderAdminContentDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { id: activityId } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("活动不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const current = await this.prisma.learningActivity.findUnique({ where: { id: activityId }, select: { id: true, lessonId: true, sortOrder: true } });
    if (!current) throw new NotFoundException("活动不存在");
    await this.prisma.$transaction(async (tx) => {
      await tx.learningActivity.update({ where: { id: activityId }, data: { sortOrder: -1 } });
      await tx.learningActivity.updateMany({ where: { lessonId: current.lessonId, sortOrder: dto.sortOrder }, data: { sortOrder: current.sortOrder } });
      await tx.learningActivity.update({ where: { id: activityId }, data: { sortOrder: dto.sortOrder } });
    });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_ACTIVITY_REORDERED", "LearningActivity", activityId, { sortOrder: current.sortOrder }, { sortOrder: dto.sortOrder });
    return { id: activityId, lessonId: current.lessonId, sortOrder: dto.sortOrder };
  }

  @Delete("curriculum/:versionId/activities/:activityId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async deleteCurriculumActivity(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { id: activityId } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("活动不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可删除`);
    const activity = await this.prisma.learningActivity.findUnique({ where: { id: activityId }, select: { id: true, lessonId: true, _count: { select: { progress: true, attempts: true } } } });
    if (!activity) throw new NotFoundException("活动不存在");
    if (activity._count.progress > 0 || activity._count.attempts > 0) throw new ConflictException("活动已有学生学习记录，不能删除");
    await this.prisma.learningActivity.delete({ where: { id: activityId } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_ACTIVITY_DELETED", "LearningActivity", activityId, { versionId, lessonId: activity.lessonId }, null);
    return { id: activityId, deleted: true };
  }

  @Post("curriculum/:versionId/activities/:activityId/questions")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createCurriculumQuestion(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("activityId", ParseUUIDPipe) activityId: string, @Body() dto: CreateAdminQuestionDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { id: activityId } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("活动不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const question = await this.prisma.question.create({ data: {
      activityId, kind: dto.kind.trim(), prompt: dto.prompt as Prisma.InputJsonValue, answerKey: dto.answerKey as Prisma.InputJsonValue, sortOrder: dto.sortOrder,
      ...(dto.explanation !== undefined ? { explanation: dto.explanation as Prisma.InputJsonValue } : {}),
    }, select: { id: true, activityId: true, kind: true, prompt: true, answerKey: true, explanation: true, sortOrder: true } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_QUESTION_CREATED", "Question", question.id, null, { versionId, activityId });
    return question;
  }

  @Patch("curriculum/:versionId/questions/:questionId/reorder")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async reorderCurriculumQuestion(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("questionId", ParseUUIDPipe) questionId: string, @Body() dto: ReorderAdminContentDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { questions: { some: { id: questionId } } } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("题目不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const current = await this.prisma.question.findUnique({ where: { id: questionId }, select: { id: true, activityId: true, sortOrder: true } });
    if (!current) throw new NotFoundException("题目不存在");
    await this.prisma.$transaction(async (tx) => {
      await tx.question.update({ where: { id: questionId }, data: { sortOrder: -1 } });
      await tx.question.updateMany({ where: { activityId: current.activityId, sortOrder: dto.sortOrder }, data: { sortOrder: current.sortOrder } });
      await tx.question.update({ where: { id: questionId }, data: { sortOrder: dto.sortOrder } });
    });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_QUESTION_REORDERED", "Question", questionId, { sortOrder: current.sortOrder }, { sortOrder: dto.sortOrder });
    return { id: questionId, activityId: current.activityId, sortOrder: dto.sortOrder };
  }

  @Delete("curriculum/:versionId/questions/:questionId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async deleteCurriculumQuestion(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("questionId", ParseUUIDPipe) questionId: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { questions: { some: { id: questionId } } } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("题目不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可删除`);
    const question = await this.prisma.question.findUnique({ where: { id: questionId }, select: { id: true, activityId: true, _count: { select: { assessmentItems: true } } } });
    if (!question) throw new NotFoundException("题目不存在");
    if (question._count.assessmentItems > 0) throw new ConflictException("题目已有测评答题记录，不能删除");
    await this.prisma.question.delete({ where: { id: questionId } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_QUESTION_DELETED", "Question", questionId, { versionId, activityId: question.activityId }, null);
    return { id: questionId, deleted: true };
  }

  @Patch("curriculum/:versionId/questions/batch")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async batchUpdateCurriculumQuestions(@Param("versionId", ParseUUIDPipe) versionId: string, @Body() dto: BatchAdminQuestionUpdateDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    if (dto.updates.length === 0) throw new ConflictException("批量更新不能为空");
    const ids = dto.updates.map((update) => update.id);
    if (new Set(ids).size !== ids.length) throw new ConflictException("批量更新中不能重复指定题目");
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("课程版本不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const rows = await this.prisma.question.findMany({ where: { id: { in: ids }, activity: { lesson: { unit: { courseVersionId: versionId } } } }, select: { id: true } });
    if (rows.length !== ids.length) throw new ForbiddenException("批量更新包含不属于当前课程版本的题目");
    const byId = new Map(dto.updates.map((update) => [update.id, update]));
    const result = await this.prisma.$transaction(async (tx) => {
      await Promise.all(ids.map((id, index) => tx.question.update({ where: { id }, data: { sortOrder: -1000000 - index } })));
      return Promise.all(ids.map((id) => { const update = byId.get(id)!; return tx.question.update({ where: { id }, data: { ...(update.kind !== undefined ? { kind: update.kind.trim() } : {}), ...(update.sortOrder !== undefined ? { sortOrder: update.sortOrder } : {}) }, select: { id: true, kind: true, sortOrder: true } }); }));
    });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_QUESTIONS_BATCH_UPDATED", "Question", versionId, null, { count: result.length, ids });
    return { items: result };
  }

  @Patch("curriculum/:versionId/questions/:questionId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async updateCurriculumQuestion(@Param("versionId", ParseUUIDPipe) versionId: string, @Param("questionId", ParseUUIDPipe) questionId: string, @Body() dto: UpdateAdminQuestionDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id: versionId, ...(schoolId ? { schoolId } : {}), units: { some: { lessons: { some: { activities: { some: { questions: { some: { id: questionId } } } } } } } } }, select: { id: true, schoolId: true, status: true } });
    if (!version) throw new NotFoundException("题目不存在或不在当前管理范围");
    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${version.status} 的版本不可编辑`);
    const question = await this.prisma.question.update({ where: { id: questionId }, data: {
      ...(dto.kind !== undefined ? { kind: dto.kind.trim() } : {}),
      ...(dto.prompt !== undefined ? { prompt: dto.prompt as Prisma.InputJsonValue } : {}),
      ...(dto.answerKey !== undefined ? { answerKey: dto.answerKey as Prisma.InputJsonValue } : {}),
      ...(dto.explanation !== undefined ? { explanation: dto.explanation as Prisma.InputJsonValue } : {}),
    }, select: { id: true, activityId: true, kind: true, prompt: true, answerKey: true, explanation: true, sortOrder: true } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_QUESTION_UPDATED", "Question", questionId, null, { versionId, kind: question.kind });
    return question;
  }

  @Patch("curriculum/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async updateCurriculum(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAdminCurriculumDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const before = await this.prisma.courseVersion.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, status: true, title: true, description: true, gradeBand: true, objectives: true, updatedAt: true } });
    if (!before) throw new NotFoundException("课程版本不存在或不在当前管理范围");
    if (before.status !== "DRAFT" && before.status !== "CHANGES_REQUESTED") throw new ConflictException(`状态为 ${before.status} 的版本不可编辑`);
    if (before.updatedAt.getTime() !== new Date(dto.expectedUpdatedAt).getTime()) throw new ConflictException("课程版本已被其他人修改，请刷新后重试");
    const after = await this.prisma.courseVersion.update({ where: { id }, data: {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.gradeBand !== undefined ? { gradeBand: dto.gradeBand } : {}),
      ...(dto.objectives !== undefined ? { objectives: dto.objectives as Prisma.InputJsonValue } : {}),
    }, select: { id: true, schoolId: true, status: true, title: true, description: true, gradeBand: true, objectives: true, updatedAt: true } });
    await this.audit(principal.userId, after.schoolId, "ADMIN_CURRICULUM_UPDATED", "CourseVersion", id, { title: before.title, status: before.status }, { title: after.title, status: after.status });
    return after;
  }

  @Post("curriculum/:id/publish")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async publishCurriculum(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const before = await this.prisma.courseVersion.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, status: true, title: true, version: true } });
    if (!before) throw new NotFoundException("课程版本不存在或不在当前管理范围");
    if (before.status !== "APPROVED") throw new ConflictException(`状态为 ${before.status} 的版本不可发布，必须先通过审核`);
    const after = await this.prisma.courseVersion.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() }, select: { id: true, schoolId: true, status: true, title: true, version: true, publishedAt: true } });
    await this.audit(principal.userId, after.schoolId, "ADMIN_CURRICULUM_PUBLISHED", "CourseVersion", id, { status: before.status }, { status: after.status, version: after.version });
    return after;
  }

  @Post("curriculum/:id/assignments")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createCurriculumAssignment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AdminCreateAssignmentDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const startsAt = new Date(dto.startsAt);
    const dueAt = new Date(dto.dueAt);
    if (dueAt <= startsAt) throw new ConflictException("作业截止时间必须晚于开始时间");
    const scopedSchoolId = this.scopeSchoolId(principal, tenant);
    const version = await this.prisma.courseVersion.findFirst({ where: { id, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) }, select: { id: true, schoolId: true, status: true, title: true } });
    if (!version) throw new NotFoundException("课程版本不存在或不在当前管理范围");
    if (version.status !== "PUBLISHED") throw new ConflictException("只有已发布课程版本才能关联任务");
    const classIds = dto.targets.filter((target) => target.targetType === "CLASS").map((target) => target.classId).filter((value): value is string => Boolean(value));
    const enrollmentIds = dto.targets.filter((target) => target.targetType === "STUDENT").map((target) => target.enrollmentId).filter((value): value is string => Boolean(value));
    if (classIds.length + enrollmentIds.length === 0) throw new ConflictException("至少选择一个班级或学生作为任务目标");
    if (classIds.length !== new Set(classIds).size || enrollmentIds.length !== new Set(enrollmentIds).size) throw new ConflictException("任务目标不能重复");
    const [classes, enrollments] = await Promise.all([
      this.prisma.class.findMany({ where: { schoolId: version.schoolId, id: { in: classIds } }, select: { id: true } }),
      this.prisma.enrollment.findMany({ where: { schoolId: version.schoolId, id: { in: enrollmentIds }, role: "STUDENT", status: "ACTIVE" }, select: { id: true } }),
    ]);
    if (classes.length !== classIds.length || enrollments.length !== enrollmentIds.length) throw new ForbiddenException("存在不属于当前学校或已失效的任务目标");
    const assignment = await this.prisma.assignment.create({ data: {
      schoolId: version.schoolId, courseVersionId: version.id, createdByUserId: principal.userId,
      title: dto.title.trim(), startsAt, dueAt, offlineRequired: dto.offlineRequired ?? false,
      targets: { create: [
        ...classIds.map((classId) => ({ schoolId: version.schoolId, targetType: "CLASS" as const, classId })),
        ...enrollmentIds.map((enrollmentId) => ({ schoolId: version.schoolId, targetType: "STUDENT" as const, enrollmentId })),
      ] },
    }, select: { id: true, schoolId: true, courseVersionId: true, title: true, status: true, startsAt: true, dueAt: true, offlineRequired: true, createdAt: true, targets: { select: { id: true, targetType: true, classId: true, enrollmentId: true } } } });
    await this.audit(principal.userId, version.schoolId, "ADMIN_CURRICULUM_ASSIGNMENT_CREATED", "Assignment", assignment.id, null, { courseVersionId: version.id, targetCount: assignment.targets.length });
    return assignment;
  }

  @Patch("schools/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async updateSchool(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSchoolDto, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.school.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException("学校不存在");
    const code = dto.code?.trim().toUpperCase();
    if (code && code !== before.code) {
      const collision = await this.prisma.school.findUnique({ where: { code } });
      if (collision) throw new ConflictException("学校编码已存在");
    }
    const after = await this.prisma.school.update({ where: { id }, data: {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(code ? { code } : {}), ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.regionCode !== undefined ? { regionCode: dto.regionCode.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    } });
    await this.audit(principal.userId, id, "ADMIN_SCHOOL_UPDATED", "School", id, { name: before.name, code: before.code, isActive: before.isActive }, { name: after.name, code: after.code, isActive: after.isActive });
    return after;
  }

  @Delete("schools/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async deleteSchool(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.school.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException("学校不存在");
    const after = await this.prisma.school.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await this.audit(principal.userId, id, "ADMIN_SCHOOL_DEACTIVATED", "School", id, { isActive: true }, { isActive: false });
    return { id: after.id, isActive: after.isActive, deletedAt: after.deletedAt };
  }

  @Get("users")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listUsers(@Query() query: ListUsersQueryDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const users = query.search
      ? await this.prisma.user.findMany({ where: { OR: [{ displayName: { contains: query.search } }, { loginIdentifier: { contains: query.search } }] }, select: { id: true, loginIdentifier: true, displayName: true, status: true, preferredLocale: true, createdAt: true, updatedAt: true } })
      : null;
    const memberships = await this.prisma.membership.findMany({
      where: { ...(schoolId ? { schoolId } : {}), ...(query.role ? { role: query.role } : {}), ...(query.status ? { status: query.status } : {}), ...(users ? { userId: { in: users.map((user) => user.id) } } : {}) },
      orderBy: { joinedAt: "desc" }, take: query.limit,
    });
    const userRows = users ?? await this.prisma.user.findMany({ where: { id: { in: memberships.map((membership) => membership.userId) } }, select: { id: true, loginIdentifier: true, displayName: true, status: true, preferredLocale: true, createdAt: true, updatedAt: true } });
    const schoolRows = await this.prisma.school.findMany({ where: { id: { in: memberships.map((membership) => membership.schoolId) } }, select: { id: true, name: true, code: true } });
    const userById = new Map(userRows.map((user) => [user.id, user]));
    const schoolById = new Map(schoolRows.map((school) => [school.id, school]));
    return { items: memberships.flatMap((membership) => { const user = userById.get(membership.userId); const school = schoolById.get(membership.schoolId); return user && school ? [{ membershipId: membership.id, school, user, role: membership.role, membershipStatus: membership.status, joinedAt: membership.joinedAt }] : []; }) };
  }

  @Post("users/invitations")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async inviteUser(@Body() dto: InviteUserDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant) ?? tenant.schoolId;
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) throw new ConflictException("邀请有效期必须晚于当前时间");
    const row = await this.prisma.inviteCode.create({ data: { schoolId, code: `YZ-${randomBytes(6).toString("hex").toUpperCase()}`, createdByUserId: principal.userId, maxUses: dto.maxUses, expiresAt } });
    await this.audit(principal.userId, schoolId, "ADMIN_INVITE_CREATED", "InviteCode", row.id, null, { maxUses: row.maxUses, expiresAt: row.expiresAt });
    return { id: row.id, schoolId: row.schoolId, code: row.code, maxUses: row.maxUses, usedCount: row.usedCount, expiresAt: row.expiresAt };
  }

  @Get("users/invitations")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listInvitations(@CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const rows = await this.prisma.inviteCode.findMany({ where: schoolId ? { schoolId } : {}, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, schoolId: true, code: true, maxUses: true, usedCount: true, expiresAt: true, revokedAt: true, createdByUserId: true, createdAt: true } });
    return { items: rows.map((row) => ({ ...row, exhausted: row.usedCount >= row.maxUses, expired: row.expiresAt <= new Date(), revoked: Boolean(row.revokedAt) })), scope: schoolId ? { schoolId } : { allSchools: true } };
  }

  @Post("users/invitations/:id/revoke")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async revokeInvitation(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const before = await this.prisma.inviteCode.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, revokedAt: true, usedCount: true, maxUses: true } });
    if (!before) throw new NotFoundException("邀请码不存在或不在当前管理范围");
    if (before.revokedAt) return { id: before.id, revokedAt: before.revokedAt, idempotent: true };
    const revokedAt = new Date();
    const result = await this.prisma.inviteCode.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } });
    if (result.count !== 1) {
      const current = await this.prisma.inviteCode.findUnique({ where: { id }, select: { revokedAt: true } });
      if (current?.revokedAt) return { id, revokedAt: current.revokedAt, idempotent: true };
      throw new ConflictException("邀请码撤销失败，请刷新后重试");
    }
    await this.audit(principal.userId, before.schoolId, "ADMIN_INVITE_REVOKED", "InviteCode", id, { revokedAt: null, usedCount: before.usedCount, maxUses: before.maxUses }, { revokedAt });
    return { id, revokedAt, idempotent: false };
  }

  @Get("users/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async getUser(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const memberships = await this.prisma.membership.findMany({ where: { userId: id, ...(schoolId ? { schoolId } : {}) }, orderBy: { joinedAt: "desc" }, select: { id: true, userId: true, schoolId: true, role: true, status: true, joinedAt: true } });
    if (memberships.length === 0) throw new NotFoundException("用户不存在或不在当前管理范围");
    const user = await this.prisma.user.findFirst({ where: { id }, select: { id: true, loginIdentifier: true, displayName: true, preferredLocale: true, status: true, createdAt: true, updatedAt: true } });
    if (!user) throw new NotFoundException("用户不存在");
    const [schools, activeSessions, securityAudit] = await Promise.all([
      this.prisma.school.findMany({ where: { id: { in: memberships.map((membership) => membership.schoolId) } }, select: { id: true, code: true, name: true } }),
      this.prisma.sessionPair.count({ where: { userId: id, revokedAt: null } }),
      this.prisma.auditLog.findMany({ where: { actorUserId: id, ...(schoolId ? { schoolId } : {}) }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, schoolId: true, action: true, resourceType: true, resourceId: true, createdAt: true } }),
    ]);
    const schoolById = new Map(schools.map((school) => [school.id, school]));
    return { user, memberships: memberships.map((membership) => ({ ...membership, school: schoolById.get(membership.schoolId) ?? null })), activeSessions, securityAudit };
  }

  @Get("users/:id/privacy-export")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async privacyExportUser(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const memberships = await this.prisma.membership.findMany({ where: { userId: id, ...(schoolId ? { schoolId } : {}) }, orderBy: { joinedAt: "desc" }, select: { id: true, schoolId: true, role: true, status: true, joinedAt: true } });
    if (memberships.length === 0) throw new NotFoundException("用户不存在或不在当前管理范围");
    const user = await this.prisma.user.findFirst({ where: { id }, select: { id: true, loginIdentifier: true, displayName: true, preferredLocale: true, status: true, createdAt: true, updatedAt: true } });
    if (!user) throw new NotFoundException("用户不存在");
    const scoped = schoolId ? { schoolId } : {};
    const [submissionCount, assessmentCount, recordingCount, feedbackCount] = await Promise.all([
      this.prisma.submission.count({ where: { ...scoped, enrollment: { userId: id } } }),
      this.prisma.assessmentSession.count({ where: { ...scoped, enrollment: { userId: id } } }),
      this.prisma.recording.count({ where: { ...scoped, enrollment: { userId: id } } }),
      this.prisma.feedback.count({ where: { ...scoped, submission: { enrollment: { userId: id } } } }),
    ]);
    const payload = {
      exportVersion: "1.0",
      generatedAt: new Date().toISOString(),
      subject: user,
      memberships,
      learningEvidence: { submissions: submissionCount, assessments: assessmentCount, recordings: recordingCount, feedback: feedbackCount },
      exclusions: ["passwordHash", "accessToken", "refreshToken", "rawRecordingContent"],
    };
    await this.audit(principal.userId, schoolId ?? memberships[0]?.schoolId ?? null, "ADMIN_PRIVACY_EXPORT_CREATED", "User", id, null, { exportVersion: payload.exportVersion, scope: schoolId ? { schoolId } : { allSchools: true } });
    return payload;
  }

  @Get("privacy/requests")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listPrivacyRequests(@Query() query: PrivacyRequestQueryDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const items = await this.prisma.privacyRequest.findMany({ where: { ...(schoolId ? { schoolId } : {}), ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : {}) }, orderBy: { createdAt: "desc" }, take: query.limit, select: { id: true, schoolId: true, subjectUserId: true, requestedByUserId: true, reviewedByUserId: true, type: true, status: true, reason: true, decisionComment: true, approvedAt: true, completedAt: true, createdAt: true, updatedAt: true } });
    return { items, scope: schoolId ? { schoolId } : { allSchools: true } };
  }

  @Post("privacy/requests")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createPrivacyRequest(@Body() dto: CreatePrivacyRequestDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const membership = await this.prisma.membership.findFirst({ where: { userId: dto.subjectUserId, ...(schoolId ? { schoolId } : {}), status: "ACTIVE" }, select: { schoolId: true } });
    if (!membership) throw new NotFoundException("用户不存在或不在当前管理范围");
    if (dto.type !== "EXPORT" && !dto.reason?.trim()) throw new ConflictException("删除或冻结请求必须填写原因");
    const existing = await this.prisma.privacyRequest.findFirst({ where: { subjectUserId: dto.subjectUserId, schoolId: membership.schoolId, type: dto.type, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } });
    if (existing) throw new ConflictException("已有相同的隐私请求正在处理中");
    const row = await this.prisma.privacyRequest.create({ data: { schoolId: membership.schoolId, subjectUserId: dto.subjectUserId, requestedByUserId: principal.userId, type: dto.type, ...(dto.reason?.trim() ? { reason: dto.reason.trim() } : {}) }, select: { id: true, schoolId: true, subjectUserId: true, requestedByUserId: true, type: true, status: true, reason: true, createdAt: true } });
    await this.audit(principal.userId, membership.schoolId, "ADMIN_PRIVACY_REQUEST_CREATED", "PrivacyRequest", row.id, null, { subjectUserId: row.subjectUserId, type: row.type });
    return row;
  }

  @Post("privacy/requests/:id/decision")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async decidePrivacyRequest(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PrivacyRequestDecisionDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const before = await this.prisma.privacyRequest.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true } });
    if (!before) throw new NotFoundException("隐私请求不存在或不在当前管理范围");
    if (before.type !== "EXPORT" && !principal.roles.includes(MembershipRole.PLATFORM_ADMIN)) throw new ForbiddenException("删除或冻结请求必须由平台管理员审批");
    const nextStatus = dto.decision === "APPROVE" ? "APPROVED" : dto.decision === "REJECT" ? "REJECTED" : "COMPLETED";
    if (dto.decision === "COMPLETE" && before.status !== "APPROVED") throw new ConflictException("只有已批准的隐私请求才能标记完成");
    if (dto.decision !== "COMPLETE" && before.status !== "PENDING") throw new ConflictException(`当前状态为 ${before.status}，不可重复审批`);
    const after = await this.prisma.privacyRequest.update({ where: { id }, data: { status: nextStatus, reviewedByUserId: principal.userId, ...(dto.decision === "APPROVE" ? { approvedAt: new Date() } : {}), ...(dto.decision === "COMPLETE" ? { completedAt: new Date() } : {}), ...(dto.comment?.trim() ? { decisionComment: dto.comment.trim() } : {}) }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true, reviewedByUserId: true, decisionComment: true, approvedAt: true, completedAt: true, updatedAt: true } });
    await this.audit(principal.userId, after.schoolId, "ADMIN_PRIVACY_REQUEST_DECIDED", "PrivacyRequest", id, { status: before.status }, { status: after.status, decision: dto.decision });
    return after;
  }

  @Post("privacy/requests/:id/execute")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async executePrivacyRequest(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.privacyRequest.findFirst({ where: { id }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true } });
    if (!before) throw new NotFoundException("隐私请求不存在");
    if (before.status !== "APPROVED") throw new ConflictException(`当前状态为 ${before.status}，只有已批准请求才能执行`);
    if (before.type === "EXPORT") throw new ConflictException("导出请求应通过安全导出接口完成");
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.sessionPair.updateMany({ where: { userId: before.subjectUserId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (before.type === "FREEZE") {
        const memberships = await tx.membership.findMany({ where: { userId: before.subjectUserId, schoolId: before.schoolId }, select: { id: true, status: true } });
        await tx.user.update({ where: { id: before.subjectUserId }, data: { status: "SUSPENDED" } });
        await tx.membership.updateMany({ where: { userId: before.subjectUserId, schoolId: before.schoolId, status: "ACTIVE" }, data: { status: "SUSPENDED" } });
        return tx.privacyRequest.update({ where: { id }, data: { status: "COMPLETED", reviewedByUserId: principal.userId, completedAt: new Date(), executionSnapshot: memberships as Prisma.InputJsonValue }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true, completedAt: true } });
      } else {
        await tx.user.update({ where: { id: before.subjectUserId }, data: { status: "DISABLED", loginIdentifier: `deleted-${before.subjectUserId}`, displayName: "已删除用户", passwordHash: `redacted-${randomBytes(24).toString("hex")}` } });
        await tx.membership.updateMany({ where: { userId: before.subjectUserId, schoolId: before.schoolId, status: { in: ["ACTIVE", "SUSPENDED", "INVITED"] } }, data: { status: "LEFT" } });
      }
      return tx.privacyRequest.update({ where: { id }, data: { status: "COMPLETED", reviewedByUserId: principal.userId, completedAt: new Date() }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true, completedAt: true } });
    });
    await this.audit(principal.userId, result.schoolId, "ADMIN_PRIVACY_REQUEST_EXECUTED", "PrivacyRequest", id, { status: before.status, type: before.type }, { status: result.status, subjectUserId: result.subjectUserId });
    return result;
  }

  @Post("privacy/requests/:id/revoke")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async revokePrivacyFreeze(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal) {
    const before = await this.prisma.privacyRequest.findFirst({ where: { id }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true, executionSnapshot: true } });
    if (!before) throw new NotFoundException("隐私请求不存在");
    if (before.type !== "FREEZE" || before.status !== "COMPLETED") throw new ConflictException("只有已完成的冻结请求可以撤销");
    const snapshot = Array.isArray(before.executionSnapshot) ? before.executionSnapshot as Array<{ id?: string; status?: string }> : [];
    if (!snapshot.length) throw new ConflictException("冻结请求缺少可恢复的状态快照");
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: before.subjectUserId }, data: { status: "ACTIVE" } });
      for (const membership of snapshot) {
        if (membership.id && membership.status) await tx.membership.update({ where: { id: membership.id }, data: { status: membership.status as "INVITED" | "ACTIVE" | "SUSPENDED" | "LEFT" } });
      }
      return tx.privacyRequest.update({ where: { id }, data: { status: "CANCELLED", revokedAt: new Date(), revokedByUserId: principal.userId }, select: { id: true, schoolId: true, subjectUserId: true, type: true, status: true, revokedAt: true, revokedByUserId: true } });
    });
    await this.audit(principal.userId, result.schoolId, "ADMIN_PRIVACY_REQUEST_REVOKED", "PrivacyRequest", id, { status: before.status }, { status: result.status, subjectUserId: result.subjectUserId });
    return result;
  }

  @Patch("users/:id/membership")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async updateMembership(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant) ?? tenant.schoolId;
    const before = await this.prisma.membership.findFirst({ where: { id, schoolId }, include: { user: { select: { id: true, displayName: true } } } });
    if (!before) throw new NotFoundException("成员关系不存在");
    if (principal.roles.includes(MembershipRole.SCHOOL_ADMIN) && before.role === MembershipRole.PLATFORM_ADMIN) throw new ForbiddenException("学校管理员不能修改平台管理员");
    if (dto.role === MembershipRole.PLATFORM_ADMIN && !principal.roles.includes(MembershipRole.PLATFORM_ADMIN)) throw new ForbiddenException("只有平台管理员可以授予平台角色");
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({ where: { id }, data: { ...(dto.role ? { role: dto.role } : {}), ...(dto.status ? { status: dto.status } : {}) } });
      if (dto.role || dto.status) {
        await tx.sessionPair.updateMany({ where: { userId: before.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return updated;
    });
    await this.audit(principal.userId, schoolId, "ADMIN_MEMBERSHIP_UPDATED", "Membership", id, { role: before.role, status: before.status }, { role: after.role, status: after.status });
    return { membershipId: after.id, userId: after.userId, schoolId: after.schoolId, role: after.role, status: after.status };
  }

  @Get("content-review/queue")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listContentReviewQueue(@Query() query: ContentReviewQueryDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const rows = await this.prisma.courseVersion.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        status: query.status,
        ...(query.search ? { title: { contains: query.search } } : {}),
      },
      orderBy: [{ submittedAt: "asc" }, { updatedAt: "asc" }],
      take: query.limit,
      select: { id: true, schoolId: true, courseId: true, version: true, status: true, title: true, description: true, gradeBand: true, submittedAt: true, updatedAt: true, createdAt: true },
    });
    return { items: rows, scope: schoolId ? { schoolId } : { allSchools: true } };
  }

  @Get("assessment/overview")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async assessmentOverview(@CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const scope = schoolId ? { schoolId } : {};
    const [created, inProgress, submitted, processing, completed, cancelled, reports, flaggedItems] = await Promise.all([
      this.prisma.assessmentSession.count({ where: { ...scope, status: "CREATED" } }),
      this.prisma.assessmentSession.count({ where: { ...scope, status: "IN_PROGRESS" } }),
      this.prisma.assessmentSession.count({ where: { ...scope, status: "SUBMITTED" } }),
      this.prisma.assessmentSession.count({ where: { ...scope, status: "PROCESSING" } }),
      this.prisma.assessmentSession.count({ where: { ...scope, status: "COMPLETED" } }),
      this.prisma.assessmentSession.count({ where: { ...scope, status: "CANCELLED" } }),
      this.prisma.assessmentReport.count({ where: { ...scope } }),
      this.prisma.assessmentItem.count({ where: { status: "FLAGGED", session: scope } }),
    ]);
    return { scope: schoolId ? { schoolId } : { allSchools: true }, sessions: { created, inProgress, submitted, processing, completed, cancelled }, reports, flaggedItems, generatedAt: new Date().toISOString() };
  }

  @Get("content-review/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async getContentReview(@Param("id", ParseUUIDPipe) id: string, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const row = await this.prisma.courseVersion.findFirst({ where: { id, ...(this.scopeSchoolId(principal, tenant) ? { schoolId: tenant.schoolId } : {}) }, select: { id: true, schoolId: true, courseId: true, version: true, status: true, title: true, description: true, gradeBand: true, locale: true, objectives: true, submittedAt: true, approvedAt: true, publishedAt: true, updatedAt: true, units: { select: { id: true, title: true, sortOrder: true, lessons: { select: { id: true, title: true, sortOrder: true } } } }, reviews: { orderBy: { createdAt: "desc" }, select: { id: true, reviewerUserId: true, decision: true, comment: true, createdAt: true } } } });
    if (!row) throw new NotFoundException("待审核内容不存在");
    return row;
  }

  @Post("content-review/:id/decision")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async reviewContent(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ContentReviewDecisionDto, @CurrentPrincipal() principal: Principal, @CurrentTenant() tenant: TenantContext) {
    const schoolId = this.scopeSchoolId(principal, tenant);
    const before = await this.prisma.courseVersion.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: { id: true, schoolId: true, status: true, title: true, version: true } });
    if (!before) throw new NotFoundException("待审核内容不存在");
    if (before.status !== "IN_REVIEW") throw new ConflictException(`当前状态为 ${before.status}，不可重复审核`);
    if (dto.decision !== "APPROVE" && !dto.comment?.trim()) throw new ConflictException("退回或要求补充证据时必须填写审核意见");
    const nextStatus = dto.decision === "APPROVE" ? "APPROVED" : "CHANGES_REQUESTED";
    const after = await this.prisma.$transaction(async (tx) => {
      const version = await tx.courseVersion.update({ where: { id: before.id }, data: { status: nextStatus, ...(dto.decision === "APPROVE" ? { approvedAt: new Date() } : {}) } });
      await tx.courseReview.create({ data: { courseVersionId: before.id, reviewerUserId: principal.userId, decision: dto.decision, ...(dto.comment?.trim() ? { comment: dto.comment.trim() } : {}) } });
      return version;
    });
    await this.audit(principal.userId, before.schoolId, "ADMIN_CONTENT_REVIEWED", "CourseVersion", id, { status: before.status }, { status: after.status, decision: dto.decision });
    return { id: after.id, schoolId: after.schoolId, status: after.status, decision: dto.decision, reviewedAt: new Date().toISOString() };
  }

  private scopeSchoolId(principal: Principal, tenant: TenantContext): string | null {
    return principal.roles.includes(MembershipRole.PLATFORM_ADMIN) ? null : tenant.schoolId;
  }

  private assertScopedSchool(principal: Principal, tenant: TenantContext, schoolId: string): void {
    if (!principal.roles.includes(MembershipRole.PLATFORM_ADMIN) && tenant.schoolId !== schoolId) throw new ForbiddenException("无权访问其他学校");
  }

  private async audit(actorUserId: string, schoolId: string | null, action: string, resourceType: string, resourceId: string, beforeSummary: unknown, afterSummary: unknown): Promise<void> {
    await this.prisma.auditLog.create({ data: { actorUserId, schoolId, action, resourceType, resourceId, requestId: `admin-${Date.now()}`, ...(beforeSummary === null ? {} : { beforeSummary: beforeSummary as object }), ...(afterSummary === null ? {} : { afterSummary: afterSummary as object }) } });
  }
}
