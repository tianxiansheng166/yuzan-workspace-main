import {
  Body,
  Controller,
  Delete,
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
import { ProvidersService } from "./providers.service.js";
import { CreateProviderDto } from "../dto/create-provider.dto.js";
import { UpdateProviderDto } from "../dto/update-provider.dto.js";
import type { ProviderType } from "../domain/provider.types.js";

@Controller("api/v1/admin/providers")
export class ProvidersController {
  constructor(
    @Inject(ProvidersService)
    private readonly service: ProvidersService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
    @Query("type") type?: ProviderType,
    @Query("enabled") enabled?: string,
  ) {
    const parsedEnabled =
      enabled === "true" ? true : enabled === "false" ? false : undefined;
    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      type,
      parsedEnabled,
    );
  }

  @Get(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async findById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.findById(
      createAuthContext("request-id", principal, tenant),
      id,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async create(
    @Body() dto: CreateProviderDto,
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
    @Body() dto: UpdateProviderDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.update(
      createAuthContext("request-id", principal, tenant),
      id,
      dto,
    );
  }

  @Delete(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.delete(
      createAuthContext("request-id", principal, tenant),
      id,
    );
  }

  @Post(":id:check-health")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async checkHealth(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.checkHealth(
      createAuthContext("request-id", principal, tenant),
      id,
    );
  }

  @Get(":id:health")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async getHealthStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getHealthStatus(
      createAuthContext("request-id", principal, tenant),
      id,
    );
  }
}
