import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
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
} from "../../../common/security/index.js";
import { DeletionService } from "./deletion.service.js";
import { ProcessDeletionDto } from "../dto/process-deletion.dto.js";
import type { DeletionRequestStatus } from "../domain/privacy.types.js";

@Controller("api/v1/admin/privacy/deletion-requests")
export class DeletionController {
  constructor(
    @Inject(DeletionService)
    private readonly service: DeletionService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async list(
    @Query("limit") limit: number = 20,
    @Query("cursor") cursor: string | undefined,
    @Query("status") status: DeletionRequestStatus | undefined,
    @Query("userId") userId: string | undefined,
    @Query("schoolId") schoolId: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      {
        limit,
        ...(cursor ? { cursor } : {}),
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(schoolId ? { schoolId } : {}),
      },
    );
  }

  @Post(":id:process")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async processDeletion(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ProcessDeletionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.processDeletion(
      createAuthContext("request-id", principal, tenant),
      id,
      dto,
    );
  }
}
