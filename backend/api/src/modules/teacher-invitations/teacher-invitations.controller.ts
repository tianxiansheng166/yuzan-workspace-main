import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { Request } from "express";
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

  @Post(":invitationId/revoke")
  @HttpCode(200)
  revoke(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
  ) {
    const requestId = request.header("x-request-id") || "request-id";
    return this.service.revoke(createAuthContext(requestId, principal, tenant), schoolId, invitationId);
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
