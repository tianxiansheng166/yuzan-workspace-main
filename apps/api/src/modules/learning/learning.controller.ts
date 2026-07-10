import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CompleteActivityDto, UpdateProgressDto } from "./dto/progress.dto.js";
import { LearningService } from "./learning.service.js";

@Controller("schools/:schoolId/learning")
@RequireRoles(MembershipRole.STUDENT)
export class LearningController {
  constructor(
    @Inject(LearningService)
    private readonly service: LearningService,
  ) {}

  @Get("today")
  async listToday(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listToday(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("assignments/:assignmentId/activities/:activityId")
  async getActivityDetail(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getActivityDetail(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
    );
  }

  @Post("assignments/:assignmentId/activities/:activityId:start")
  async startSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.startSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
    );
  }

  @Get("assignments/:assignmentId/activities/:activityId:progress")
  async getProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getProgress(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
    );
  }

  @Patch("assignments/:assignmentId/activities/:activityId:progress")
  async updateProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProgress(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
      dto,
    );
  }

  @Post("assignments/:assignmentId/activities/:activityId:complete")
  async completeActivity(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Body() dto: CompleteActivityDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.completeActivity(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
      dto,
    );
  }
}
