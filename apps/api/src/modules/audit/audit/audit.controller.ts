import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
import { AuditService } from "./audit.service.js";
import { AuditSearchQueryDto } from "../dto/audit-search-query.dto.js";

@Controller("api/v1/admin/audit")
export class AuditController {
  constructor(
    @Inject(AuditService)
    private readonly service: AuditService,
  ) {}

  @Get("search")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async search(
    @Query() query: AuditSearchQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const params: import("../domain/audit.types.js").AuditSearchParams = {
      limit: query.limit,
      ...(query.schoolId ? { schoolId: query.schoolId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    };

    return this.service.search(
      createAuthContext("request-id", principal, tenant),
      params,
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
}
