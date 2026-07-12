import {
  Controller,
  Get,
  Inject,
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
import { ConsentService } from "./consent.service.js";
import { CreateConsentDto } from "../dto/create-consent.dto.js";

@Controller("api/v1/admin/privacy/consent-versions")
export class ConsentController {
  constructor(
    @Inject(ConsentService)
    private readonly service: ConsentService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async list(
    @Query("limit") limit: number = 20,
    @Query("cursor") cursor: string | undefined,
    @Query("purpose") purpose: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      { limit, ...(cursor ? { cursor } : {}), ...(purpose ? { purpose } : {}) },
    );
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async create(
    @Body() dto: CreateConsentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(
      createAuthContext("request-id", principal, tenant),
      dto,
    );
  }
}
