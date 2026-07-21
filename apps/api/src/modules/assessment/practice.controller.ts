import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { IsOptional, IsUUID } from "class-validator";
import { createAuthContext, CurrentPrincipal, CurrentTenant, MembershipRole, RequireRoles, type Principal, type TenantContext } from "../../common/security/index.js";
import { PracticeService } from "./practice.service.js";

export class CreatePracticeAttemptDto {
  @IsOptional() @IsUUID() assignmentId?: string;
  @IsOptional() @IsUUID() submissionId?: string;
  @IsOptional() @IsUUID() activityId?: string;
}

@Controller("schools/:schoolId/practices")
@RequireRoles(MembershipRole.STUDENT)
export class PracticeController {
  constructor(@Inject(PracticeService) private readonly service: PracticeService) {}

  @Get()
  list(@Param("schoolId", ParseUUIDPipe) schoolId: string, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.listForStudent(createAuthContext("request-id", principal, tenant), schoolId);
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

  @Post(":practiceDefinitionId/attempts")
  createOrResume(@Param("schoolId", ParseUUIDPipe) schoolId: string, @Param("practiceDefinitionId", ParseUUIDPipe) definitionId: string, @Body() body: CreatePracticeAttemptDto, @CurrentTenant() tenant: TenantContext, @CurrentPrincipal() principal: Principal) {
    return this.service.createOrResume(createAuthContext("request-id", principal, tenant), schoolId, definitionId, body);
  }
}
