import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, Headers } from "@nestjs/common";
import { createAuthContext, CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { OfflineService } from "./offline.service.js";
import { CreateOfflinePackageDto } from "./dto/create-offline-package.dto.js";
import { CreateSyncBatchDto } from "./dto/create-sync-batch.dto.js";
import { ListOfflinePackagesQueryDto } from "./dto/list-offline-packages-query.dto.js";

@Controller("schools/:schoolId/offline-packages")
export class OfflineController {
  constructor(@Inject(OfflineService) private readonly service: OfflineService) {}

  @Get()
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listPackages(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListOfflinePackagesQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const { limit = 20, cursor, courseVersionId } = query;
    return this.service.listPackages(createAuthContext("request-id", principal, tenant), schoolId, { limit, ...(cursor ? { cursor } : {}), ...(courseVersionId ? { courseVersionId } : {}) });
  }

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createPackage(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateOfflinePackageDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const { courseVersionId, downloadRequired = false } = dto;
    return this.service.createPackage(createAuthContext("request-id", principal, tenant), schoolId, { courseVersionId, downloadRequired });
  }

  @Get(":packageId")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getPackage(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("packageId", ParseUUIDPipe) packageId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getPackage(createAuthContext("request-id", principal, tenant), schoolId, packageId);
  }

  @Post(":packageId/download")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER)
  async authorizeDownload(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("packageId", ParseUUIDPipe) packageId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.authorizeDownload(createAuthContext("request-id", principal, tenant), schoolId, packageId);
  }
}

@Controller("schools/:schoolId/sync-batches")
export class SyncBatchController {
  constructor(@Inject(OfflineService) private readonly service: OfflineService) {}

  @Post()
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER)
  async createSyncBatch(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateSyncBatchDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createSyncBatch(createAuthContext("request-id", principal, tenant), schoolId, { deviceId: dto.deviceId, clientBatchId: dto.clientBatchId, operationCount: dto.operations.length });
  }

  @Get(":batchId")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER)
  async getSyncBatch(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getSyncBatch(createAuthContext("request-id", principal, tenant), schoolId, batchId);
  }
}
