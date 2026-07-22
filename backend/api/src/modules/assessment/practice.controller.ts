import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { createAuthContext, CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { AssessmentService } from "./assessment.service.js";
import { PracticeService, type PracticeCatalogQuery } from "./practice.service.js";

export class PracticeCatalogQueryDto implements PracticeCatalogQuery {
  @IsOptional() @IsString() query?: string;
  @IsOptional() @IsString() abilityCategory?: string;
  @IsOptional() @IsString() gradeBand?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsIn(["SHORT", "MEDIUM", "LONG"]) duration?: string;
  @IsOptional() @IsString() itemType?: string;
  @IsOptional() @IsString() cultureTag?: string;
  @IsOptional() @IsIn(["ASSIGNMENT", "SELF_PRACTICE"]) mode?: string;
  @IsOptional() @IsIn(["true", "false"]) requiresRecording?: string;
  @IsOptional() @IsIn(["true", "false"]) instantFeedback?: string;
  @IsOptional() @IsIn(["SPECIALIZED", "COMPREHENSIVE", "MOCK"]) catalogType?: string;
  @IsOptional() @IsIn(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAVORITE"]) completionStatus?: string;
  @IsOptional() @IsIn(["RECOMMENDED", "DURATION_ASC", "DURATION_DESC", "TITLE"]) sort?: string;
  @IsOptional() @IsString() cursor?: string;
}

export class CreatePracticeAttemptDto {
  @IsOptional() @IsUUID() assignmentId?: string;
  @IsOptional() @IsUUID() submissionId?: string;
  @IsOptional() @IsUUID() activityId?: string;
}

@Controller("schools/:schoolId/practices")
@RequireRoles(MembershipRole.STUDENT)
export class PracticeController {
  constructor(
    @Inject(PracticeService) private readonly service: PracticeService,
    @Inject(AssessmentService) private readonly assessmentService: AssessmentService,
  ) {}

  @Get()
  list(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Query() query: PracticeCatalogQueryDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.listForStudent(createAuthContext("request-id", principal, tenant), schoolId, query);
  }

  // Compatibility for the student practice archive.  This static route must
  // precede `:practiceDefinitionId` so it is not parsed as a UUID.
  @Get("history")
  history(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Query("range") range: string | undefined, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.assessmentService.getAssessmentHistory(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      range ? { range: range as "8w" | "6m" | "all" } : {},
    );
  }

  @Get("attempts/:attemptId")
  getAttempt(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("attemptId", ParseUUIDPipe) attemptId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.getAttempt(createAuthContext("request-id", principal, tenant), schoolId, attemptId);
  }

  @Get("attempts/:attemptId/items")
  getAttemptItems(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("attemptId", ParseUUIDPipe) attemptId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.getAttemptItems(createAuthContext("request-id", principal, tenant), schoolId, attemptId);
  }

  @Get(":practiceDefinitionId")
  detail(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("practiceDefinitionId", ParseUUIDPipe) definitionId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.getDetail(createAuthContext("request-id", principal, tenant), schoolId, definitionId);
  }

  @Post(":practiceDefinitionId/favorite")
  favorite(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("practiceDefinitionId", ParseUUIDPipe) definitionId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.addFavorite(createAuthContext("request-id", principal, tenant), schoolId, definitionId);
  }

  @Delete(":practiceDefinitionId/favorite")
  unfavorite(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("practiceDefinitionId", ParseUUIDPipe) definitionId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.removeFavorite(createAuthContext("request-id", principal, tenant), schoolId, definitionId);
  }

  @Post(":practiceDefinitionId/attempts")
  createOrResume(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("practiceDefinitionId", ParseUUIDPipe) definitionId: string, @Body() body: CreatePracticeAttemptDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.createOrResume(createAuthContext("request-id", principal, tenant), schoolId, definitionId, body);
  }
}
