import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { SyncService } from "./sync.service.js";
import { CreateSyncBatchDto, ListSyncBatchesQueryDto, UpdateSyncBatchDto } from "./dto/sync.dto.js";

@Controller("schools/:schoolId/sync")
export class SyncController {
  constructor(
    @Inject(SyncService)
    private readonly service: SyncService,
  ) {}

  @Post("batches")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createBatch(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateSyncBatchDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createBatch(schoolId, dto);
  }

  @Get("batches")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async listBatches(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListSyncBatchesQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listBatches(schoolId, query);
  }

  @Get("batches/:batchId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getBatch(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getBatch(schoolId, batchId);
  }

  @Post("batches/:batchId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async updateBatch(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @Body() dto: UpdateSyncBatchDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateBatch(schoolId, batchId, dto);
  }

  @Get("devices/:deviceId/cursors")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getCursors(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("deviceId", ParseUUIDPipe) deviceId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getCursors(schoolId, deviceId);
  }

  @Post("devices/:deviceId/cursors")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async upsertCursor(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("deviceId", ParseUUIDPipe) deviceId: string,
    @Body() body: { entityType: string; lastSyncedAt: string; lastEntityId?: string },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.upsertCursor(
      schoolId,
      deviceId,
      body.entityType,
      new Date(body.lastSyncedAt),
      body.lastEntityId,
    );
  }
}
