import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
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
import { LearningService } from "./learning.service.js";
import { UpdateProgressDto } from "./dto/update-progress.dto.js";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto.js";

@Controller("schools/:schoolId/learning")
export class LearningController {
  constructor(
    @Inject(LearningService)
    private readonly service: LearningService,
  ) {}

  @Get("tasks")
  @RequireRoles(MembershipRole.STUDENT)
  async listTasks(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() _query: ListTasksQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listTasks(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("tasks/:assignmentId")
  @RequireRoles(MembershipRole.STUDENT)
  async getTaskDetail(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getTaskDetail(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
    );
  }

  @Get("activities/:activityId/progress")
  @RequireRoles(MembershipRole.STUDENT)
  async getProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Query("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getProgress(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      activityId,
      enrollmentId,
    );
  }

  @Put("activities/:activityId/progress")
  @RequireRoles(MembershipRole.STUDENT)
  async updateProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProgress(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      activityId,
      dto.enrollmentId,
      {
        position: dto.position,
        completed: dto.completed,
        ...(dto.expectedRevision !== undefined ? { expectedRevision: dto.expectedRevision } : {}),
      },
    );
  }
}
