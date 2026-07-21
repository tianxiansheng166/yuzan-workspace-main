import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { createAuthContext, CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { BindTeacherInvitationDto } from "./dto/bind-teacher-invitation.dto.js";
import { CreateTeacherInvitationDto } from "./dto/create-teacher-invitation.dto.js";
import { TeacherInvitationsService } from "./teacher-invitations.service.js";

@Controller("schools/:schoolId/teacher-invitations")
@RequireRoles(MembershipRole.TEACHER)
export class TeacherInvitationsController {
  constructor(@Inject(TeacherInvitationsService) private readonly service: TeacherInvitationsService) {}

  @Post()
  create(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Body() dto: CreateTeacherInvitationDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.create(createAuthContext("request-id", principal, tenant), schoolId, dto);
  }

  @Get("mine")
  listMine(@Param("schoolId", ParseUUIDPipe) schoolId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.listMine(createAuthContext("request-id", principal, tenant), schoolId);
  }
}

@Controller("student/teacher-invitations")
@RequireRoles(MembershipRole.STUDENT)
export class StudentTeacherInvitationsController {
  constructor(@Inject(TeacherInvitationsService) private readonly service: TeacherInvitationsService) {}

  @Post("bind")
  bind(@Body() dto: BindTeacherInvitationDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.bind(createAuthContext("request-id", principal, tenant), dto);
  }
}
