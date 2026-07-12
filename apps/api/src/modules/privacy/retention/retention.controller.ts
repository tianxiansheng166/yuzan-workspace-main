import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
} from "../../../common/security/index.js";
import { RetentionService } from "./retention.service.js";
import { CreateRetentionDto } from "../dto/create-retention.dto.js";
import { UpdateRetentionDto } from "../dto/update-retention.dto.js";

@Controller("api/v1/admin/privacy/retention-policies")
export class RetentionController {
  constructor(
    @Inject(RetentionService)
    private readonly service: RetentionService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async list(
    @Query("limit") limit: number = 20,
    @Query("cursor") cursor: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      { limit, ...(cursor ? { cursor } : {}) },
    );
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async create(
    @Body() dto: CreateRetentionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(
      createAuthContext("request-id", principal, tenant),
      dto,
    );
  }

  @Patch(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRetentionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.update(
      createAuthContext("request-id", principal, tenant),
      id,
      dto,
    );
  }
}
