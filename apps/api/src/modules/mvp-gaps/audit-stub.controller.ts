import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Query,
  Patch,
  Post,
} from "@nestjs/common";
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min, MinLength } from "class-validator";
import { ProviderCategory, ProviderHealthStatus, ProviderStatus, type Prisma } from "@yuzan/database";
import {
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  readonly action?: string;

  @IsOptional()
  @IsString()
  readonly resourceType?: string;

  @IsOptional()
  @IsString()
  readonly actorUserId?: string;

  @IsOptional()
  @IsDateString()
  readonly from?: string;

  @IsOptional()
  @IsDateString()
  readonly to?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;
}

export class CreateAuditLogDto {
  @IsString()
  @MinLength(1)
  readonly action!: string;

  @IsString()
  @MinLength(1)
  readonly resourceType!: string;

  @IsOptional()
  @IsUUID()
  readonly resourceId?: string;

  @IsOptional()
  @IsObject()
  readonly beforeSummary?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  readonly afterSummary?: Record<string, unknown>;
}

export class ProviderQueryDto {
  @IsOptional() @IsEnum(ProviderCategory) readonly category?: ProviderCategory;
  @IsOptional() @IsEnum(ProviderStatus) readonly status?: ProviderStatus;
  @IsOptional() @IsInt() @Min(1) @Max(100) readonly limit = 50;
}

export class CreateProviderDto {
  @IsEnum(ProviderCategory) readonly category!: ProviderCategory;
  @IsString() @MinLength(1) readonly name!: string;
  @IsOptional() @IsString() readonly endpoint?: string;
  @IsOptional() @IsString() readonly secretRef?: string;
  @IsOptional() @IsObject() readonly config?: Record<string, unknown>;
  @IsOptional() @IsEnum(ProviderStatus) readonly status?: ProviderStatus;
  @IsOptional() readonly isDefault?: boolean;
}

export class UpdateProviderDto {
  @IsOptional() @IsString() readonly endpoint?: string;
  @IsOptional() @IsString() readonly secretRef?: string;
  @IsOptional() @IsEnum(ProviderStatus) readonly status?: ProviderStatus;
  @IsOptional() readonly isDefault?: boolean;
  @IsOptional() @IsObject() readonly config?: Record<string, unknown>;
}

@Controller("audit")
export class AuditStubController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("logs/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="audit-logs.csv"')
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async exportLogs(
    @Query() query: AuditLogQueryDto,
    @CurrentPrincipal() principal: Principal,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.searchLogs(query, principal, tenant);
    const header = ["id", "schoolId", "actorUserId", "action", "resourceType", "resourceId", "requestId", "createdAt"];
    const lines = [header, ...result.items.map((item) => [item.id, item.schoolId ?? "", item.actorUserId, item.action, item.resourceType, item.resourceId, item.requestId, item.createdAt.toISOString()])];
    return `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
  }

  @Post("logs")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async createLog(
    @Body() dto: CreateAuditLogDto,
    @CurrentPrincipal() principal: Principal,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const schoolId = tenant.schoolId ?? null;
    const row = await this.prisma.auditLog.create({
      data: {
        schoolId,
        actorUserId: principal.userId,
        action: dto.action,
        resourceType: dto.resourceType,
        ...(dto.resourceId ? { resourceId: dto.resourceId } : {}),
        requestId: `manual-${Date.now()}`,
        ...(dto.beforeSummary ? { beforeSummary: dto.beforeSummary as import("@yuzan/database").Prisma.InputJsonValue } : {}),
        ...(dto.afterSummary ? { afterSummary: dto.afterSummary as import("@yuzan/database").Prisma.InputJsonValue } : {}),
      },
      select: {
        id: true, schoolId: true, actorUserId: true, action: true,
        resourceType: true, resourceId: true, requestId: true,
        beforeSummary: true, afterSummary: true, createdAt: true,
      },
    });
    return row;
  }

  @Get("logs")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async searchLogs(
    @Query() query: AuditLogQueryDto,
    @CurrentPrincipal() principal: Principal,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const isPlatformAdmin = principal.roles.includes(MembershipRole.PLATFORM_ADMIN);
    const schoolId = isPlatformAdmin ? undefined : tenant.schoolId;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: { id: true, schoolId: true, actorUserId: true, action: true, resourceType: true, resourceId: true, requestId: true, beforeSummary: true, afterSummary: true, createdAt: true },
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items,
      page: { limit: query.limit, hasMore, nextCursor: hasMore ? items.at(-1)?.id ?? null : null },
      scope: schoolId ? { schoolId } : { allSchools: true },
    };
  }

  @Get("providers")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listProviders(@Query() query: ProviderQueryDto) {
    const rows = await this.prisma.providerConfig.findMany({
      where: { ...(query.category ? { category: query.category } : {}), ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ category: "asc" }, { name: "asc" }], take: query.limit,
      select: { id: true, category: true, name: true, endpoint: true, status: true, isDefault: true, config: true, createdAt: true, updatedAt: true, secretRef: true },
    });
    return { items: rows.map(({ secretRef, ...row }) => ({ ...row, secretConfigured: Boolean(secretRef) })) };
  }

  @Post("providers")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async createProvider(@Body() dto: CreateProviderDto, @CurrentPrincipal() principal: Principal) {
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.providerConfig.updateMany({ where: { category: dto.category, isDefault: true }, data: { isDefault: false } });
      return tx.providerConfig.create({ data: { category: dto.category, name: dto.name, ...(dto.endpoint !== undefined ? { endpoint: dto.endpoint } : {}), ...(dto.secretRef !== undefined ? { secretRef: dto.secretRef } : {}), status: dto.status ?? ProviderStatus.DISABLED, isDefault: dto.isDefault ?? false, ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}), createdByUserId: principal.userId }, select: { id: true, category: true, name: true, endpoint: true, status: true, isDefault: true, config: true, createdAt: true, updatedAt: true, secretRef: true } });
    });
    await this.writeProviderAudit(principal, "PROVIDER_CREATED", row.id, { category: row.category, name: row.name });
    const { secretRef, ...safe } = row;
    return { ...safe, secretConfigured: Boolean(secretRef) };
  }

  @Get("providers/:id/health")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async checkProviderHealth(@Query() _query: ProviderQueryDto, @CurrentPrincipal() principal: Principal, @Param("id") id: string) {
    const provider = await this.prisma.providerConfig.findUnique({ where: { id }, select: { id: true, endpoint: true, secretRef: true, status: true, name: true } });
    if (!provider) return { code: "PROVIDER_NOT_FOUND" };
    const status = provider.status === ProviderStatus.ENABLED && provider.endpoint && provider.secretRef ? ProviderHealthStatus.HEALTHY : (!provider.endpoint || !provider.secretRef ? ProviderHealthStatus.MISCONFIGURED : ProviderHealthStatus.UNKNOWN);
    const check = await this.prisma.providerHealthCheck.create({ data: { providerId: id, status }, select: { id: true, status: true, latencyMs: true, errorCode: true, checkedAt: true } });
    if (status === ProviderHealthStatus.MISCONFIGURED) await this.prisma.providerConfig.update({ where: { id }, data: { status: ProviderStatus.DEGRADED } });
    await this.writeProviderAudit(principal, "PROVIDER_HEALTH_CHECKED", id, { status });
    return { providerId: id, name: provider.name, status, secretConfigured: Boolean(provider.secretRef), check };
  }

  @Patch("providers/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async updateProvider(@Param("id") id: string, @Body() dto: UpdateProviderDto, @CurrentPrincipal() principal: Principal) {
    const existing = await this.prisma.providerConfig.findUnique({ where: { id }, select: { category: true } });
    if (!existing) return { code: "PROVIDER_NOT_FOUND" };
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.providerConfig.updateMany({ where: { category: existing.category, isDefault: true, NOT: { id } }, data: { isDefault: false } });
      return tx.providerConfig.update({ where: { id }, data: { ...(dto.endpoint !== undefined ? { endpoint: dto.endpoint } : {}), ...(dto.secretRef !== undefined ? { secretRef: dto.secretRef } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}), ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}), ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}) }, select: { id: true, category: true, name: true, endpoint: true, status: true, isDefault: true, config: true, createdAt: true, updatedAt: true, secretRef: true } });
    });
    await this.writeProviderAudit(principal, "PROVIDER_UPDATED", id, { status: row.status });
    const { secretRef, ...safe } = row;
    return { ...safe, secretConfigured: Boolean(secretRef) };
  }

  private async writeProviderAudit(principal: Principal, action: string, resourceId: string, afterSummary: Record<string, unknown>) {
    await this.prisma.auditLog.create({ data: { schoolId: null, actorUserId: principal.userId, action, resourceType: "ProviderConfig", resourceId, requestId: `provider-${Date.now()}`, afterSummary: afterSummary as Prisma.InputJsonValue } });
  }
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
