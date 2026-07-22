import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { TeacherService } from "./teacher.service.js";

@Controller("schools/:schoolId/teacher")
export class TeacherController {
  constructor(
    @Inject(TeacherService)
    private readonly service: TeacherService,
  ) {}

  @Get("dashboard")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.VOLUNTEER)
  async getDashboard(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getDashboard(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("students/at-risk")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.VOLUNTEER)
  async getAtRiskStudents(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAtRiskStudents(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("class/pronunciation-clusters")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getPronunciationClusters(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("classId") classId: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getPronunciationClusters(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }
}

@Controller("schools/:schoolId/notifications")
export class NotificationController {
  constructor(
    @Inject(TeacherService)
    private readonly service: TeacherService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.VOLUNTEER)
  async listNotifications(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("type") type: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("cursor") cursor: string | undefined,
    @Query("unreadOnly") unreadOnly: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listNotifications(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        ...(type ? { type } : {}),
        ...(limit ? { limit: parseInt(limit, 10) } : {}),
        ...(cursor ? { cursor } : {}),
        unreadOnly: unreadOnly === "true",
      },
    );
  }

  @Patch(":notificationId/read")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.VOLUNTEER)
  async markNotificationRead(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("notificationId", ParseUUIDPipe) notificationId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.markNotificationRead(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      notificationId,
    );
  }
}
