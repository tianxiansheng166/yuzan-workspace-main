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
import { AssessmentService } from "./assessment.service.js";
import { SaveDraftDto, SubmitAnswersDto } from "./dto/assessment.dto.js";

@Controller("schools/:schoolId/assessments")
@RequireRoles(MembershipRole.STUDENT)
export class AssessmentController {
  constructor(
    @Inject(AssessmentService)
    private readonly service: AssessmentService,
  ) {}

  @Get("assignments/:assignmentId/activities/:activityId")
  async getExercise(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getExercise(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
    );
  }

  @Get("assignments/:assignmentId/activities/:activityId:draft")
  async getDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
    );
  }

  @Patch("assignments/:assignmentId/activities/:activityId:draft")
  async saveDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Body() dto: SaveDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.saveDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
      dto,
    );
  }

  @Post("assignments/:assignmentId/activities/:activityId:submit")
  async submitAnswers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Body() dto: SubmitAnswersDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submitAnswers(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
      dto,
    );
  }

  @Get(
    "assignments/:assignmentId/activities/:activityId/attempts/:attemptId:result",
  )
  async getResult(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("activityId", ParseUUIDPipe) activityId: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getResult(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      activityId,
      attemptId,
    );
  }
}
