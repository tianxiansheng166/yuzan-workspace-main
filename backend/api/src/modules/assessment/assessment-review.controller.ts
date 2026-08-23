import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put } from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { SubmitAssessmentReviewDto } from "./dto/assessment-review.dto.js";
import { AssessmentReviewService } from "./assessment-review.service.js";

@Controller("schools/:schoolId/assessment-reviews")
export class AssessmentReviewController {
  constructor(@Inject(AssessmentReviewService) private readonly service: AssessmentReviewService) {}

  @Get()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  listQueue(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listQueue(createAuthContext("request-id", principal, tenant), schoolId);
  }

  @Get(":itemId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  getDetail(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getDetail(createAuthContext("request-id", principal, tenant), schoolId, itemId);
  }

  @Put(":itemId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  submit(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: SubmitAssessmentReviewDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submit(createAuthContext("request-id", principal, tenant), schoolId, itemId, {
      score: dto.score,
      ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
    });
  }
}
