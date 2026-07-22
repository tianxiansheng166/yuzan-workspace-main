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
} from "../../common/security/index.js";
import { ListMembersQueryDto } from "./dto/list-members-query.dto.js";
import { OrganizationsService } from "./organizations.service.js";

@Controller("schools")
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly service: OrganizationsService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async listSchools(
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listSchools(
      createAuthContext("request-id", principal, tenant),
    );
  }

  @Get(":schoolId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
    MembershipRole.PLATFORM_ADMIN,
  )
  async getSchool(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getSchool(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":schoolId/members")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listMembers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListMembersQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/membership-repository.port.js").ListMembersOptions =
      {
        limit: query.limit,
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listMembers(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get(":schoolId/members/me")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getMyMembership(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getMyMembership(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }
}
