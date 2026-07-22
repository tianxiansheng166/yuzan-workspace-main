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
import { StudentDashboardService } from "./student-dashboard.service.js";

@Controller("schools/:schoolId/student")
export class StudentDashboardController {
  constructor(
    @Inject(StudentDashboardService)
    private readonly service: StudentDashboardService,
  ) {}

  @Get("courses-dashboard")
  @RequireRoles(MembershipRole.STUDENT)
  async getCoursesDashboard(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getCoursesDashboard(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("recommendations")
  @RequireRoles(MembershipRole.STUDENT)
  async getRecommendations(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getRecommendations(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("teacher-advice")
  @RequireRoles(MembershipRole.STUDENT)
  async getTeacherAdvice(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
    @Query("limit") limit?: number,
    @Query("cursor") cursor?: string,
  ) {
    return this.service.getTeacherAdvice(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { limit: limit ?? 20, ...(cursor ? { cursor } : {}) },
    );
  }

  @Get("today")
  @RequireRoles(MembershipRole.STUDENT)
  async getTodayTasks(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getTodayTasks(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("profile")
  @RequireRoles(MembershipRole.STUDENT)
  async getProfile(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getProfile(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }
}
