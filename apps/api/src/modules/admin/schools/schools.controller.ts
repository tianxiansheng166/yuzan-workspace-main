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
import { ListSchoolsQueryDto } from "../dto/list-schools-query.dto.js";
import type { CreateSchoolDto } from "../dto/create-school.dto.js";
import type { UpdateSchoolDto } from "../dto/update-school.dto.js";
import { SchoolsService } from "./schools.service.js";

@Controller("api/v1/admin/schools")
export class AdminSchoolsController {
  constructor(
    @Inject(SchoolsService)
    private readonly service: SchoolsService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async listSchools(
    @Query() query: ListSchoolsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("../ports/admin-school-repository.port.js").AdminSchoolListOptions =
      {
        limit: query.limit,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.search ? { search: query.search } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      options,
    );
  }

  @Get(":schoolId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async getSchool(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.findById(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async createSchool(
    @Body() dto: CreateSchoolDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(
      createAuthContext("request-id", principal, tenant),
      dto,
    );
  }

  @Patch(":schoolId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async updateSchool(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: UpdateSchoolDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.update(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Post(":schoolId:activate")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async activateSchool(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.activate(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post(":schoolId:deactivate")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async deactivateSchool(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.deactivate(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post(":schoolId:archive")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async archiveSchool(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.archive(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":schoolId/usage")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async getUsageStats(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getUsageStats(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Post(":schoolId:assign-plan")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async assignPlan(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() body: { planId: string },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.assignPlan(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      body.planId,
    );
  }
}
