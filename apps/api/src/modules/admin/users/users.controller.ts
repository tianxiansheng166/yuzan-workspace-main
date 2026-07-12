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
import { BulkImportUsersDto } from "../dto/bulk-import-users.dto.js";
import { InviteUserDto } from "../dto/invite-user.dto.js";
import { UpdateMembershipDto } from "../dto/update-membership.dto.js";
import { UsersService } from "./users.service.js";

@Controller("api/v1/admin/schools/:schoolId/users")
export class AdminUsersController {
  constructor(
    @Inject(UsersService)
    private readonly service: UsersService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listUsers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query()
    query: { role?: string; status?: string; cursor?: string; limit?: string },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const limit = query.limit
      ? Number.parseInt(query.limit, 10)
      : 20;

    const options: import("../ports/admin-user-repository.port.js").AdminUserListOptions =
      {
        limit,
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      { ...options, schoolId },
    );
  }

  @Post("invite")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async inviteUser(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: InviteUserDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.invite(
      createAuthContext("request-id", principal, tenant),
      { ...dto, schoolId },
    );
  }

  @Post("bulk-import")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async bulkImportUsers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: BulkImportUsersDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.bulkImport(
      createAuthContext("request-id", principal, tenant),
      {
        users: dto.users.map((u) => ({ ...u, schoolId })),
      },
    );
  }

  @Patch(":userId/memberships/:membershipId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async updateMembership(
    @Param("schoolId", ParseUUIDPipe) _schoolId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateMembership(
      createAuthContext("request-id", principal, tenant),
      userId,
      membershipId,
      dto,
    );
  }

  @Post(":userId:revoke-sessions")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async revokeSessions(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.revokeSessions(
      createAuthContext("request-id", principal, tenant),
      userId,
    );
  }
}
