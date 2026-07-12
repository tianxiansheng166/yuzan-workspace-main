import { Controller, Get, Inject } from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../../common/security/index.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("api/v1/admin/dashboard")
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly service: DashboardService,
  ) {}

  @Get("metrics")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async getMetrics(
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getPlatformMetrics(
      createAuthContext("request-id", principal, tenant),
    );
  }
}
