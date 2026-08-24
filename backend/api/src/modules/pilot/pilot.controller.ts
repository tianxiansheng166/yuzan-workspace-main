import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { createAuthContext, CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { CreatePilotFeedbackDto, ListPilotFeedbackDto, PilotOverviewQueryDto, UpdatePilotFeedbackStatusDto } from "./dto/pilot-feedback.dto.js";
import { PilotFeedbackService } from "./pilot-feedback.service.js";
import { PilotObservabilityService } from "./pilot-observability.service.js";

@Controller("schools/:schoolId/pilot")
export class PilotController {
  constructor(
    @Inject(PilotFeedbackService) private readonly feedback: PilotFeedbackService,
    @Inject(PilotObservabilityService) private readonly observability: PilotObservabilityService,
  ) {}

  @Get("overview")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  overview(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Query() query: PilotOverviewQueryDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.observability.overview(createAuthContext("request-id", principal, tenant), schoolId, query.window);
  }

  @Post("feedback")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  createFeedback(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Body() dto: CreatePilotFeedbackDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.feedback.create(createAuthContext("request-id", principal, tenant), schoolId, dto);
  }

  @Get("feedback/mine")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  mine(@Param("schoolId", ParseUUIDPipe) schoolId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.feedback.mine(createAuthContext("request-id", principal, tenant), schoolId);
  }

  @Get("feedback")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  list(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Query() query: ListPilotFeedbackDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.feedback.list(createAuthContext("request-id", principal, tenant), schoolId, query);
  }

  @Patch("feedback/:feedbackId/status")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  updateStatus(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("feedbackId", ParseUUIDPipe) feedbackId: string, @Body() dto: UpdatePilotFeedbackStatusDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.feedback.updateStatus(createAuthContext("request-id", principal, tenant), schoolId, feedbackId, dto);
  }
}
