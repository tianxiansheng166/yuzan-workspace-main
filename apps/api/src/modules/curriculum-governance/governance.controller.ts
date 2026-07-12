import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
import { GovernanceService } from "./governance.service.js";
import { ListGovernanceVersionsQueryDto } from "./dto/list-governance-versions-query.dto.js";
import type { GovernanceVersionSummaryResponse } from "./dto/governance-version.response.js";
import type { GovernanceVersionResponse } from "./dto/governance-version.response.js";
import { toGovernanceVersionSummaryResponse, toGovernanceVersionResponse } from "./dto/governance-version.response.js";
import { SubmitReviewDto } from "./dto/submit-review.dto.js";
import type { ReviewDecisionResponse } from "./dto/review-decision.response.js";
import { toReviewDecisionResponse } from "./dto/review-decision.response.js";

@Controller("api/v1/admin/governance/course-versions")
export class GovernanceController {
  constructor(
    @Inject(GovernanceService)
    private readonly service: GovernanceService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async listVersions(
    @Query() query: ListGovernanceVersionsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ readonly items: readonly GovernanceVersionSummaryResponse[] }> {
    const result = await this.service.listAllVersions(
      createAuthContext("request-id", principal, tenant),
      {
        ...(query.status ? { status: query.status } : {}),
        ...(query.schoolId ? { schoolId: query.schoolId } : {}),
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    );

    return {
      items: result.items.map(toGovernanceVersionSummaryResponse),
    };
  }

  @Get(":courseVersionId")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async getVersion(
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<GovernanceVersionResponse> {
    const version = await this.service.findById(
      createAuthContext("request-id", principal, tenant),
      tenant.schoolId,
      courseVersionId,
    );

    return toGovernanceVersionResponse(version);
  }

  @Post(":courseVersionId:submit-review")
  @RequireRoles(
    MembershipRole.PLATFORM_ADMIN,
    MembershipRole.SCHOOL_ADMIN,
  )
  async submitForReview(
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<GovernanceVersionResponse> {
    const version = await this.service.submitForReview(
      createAuthContext("request-id", principal, tenant),
      tenant.schoolId,
      courseVersionId,
    );

    return toGovernanceVersionResponse(version);
  }

  @Post(":courseVersionId:review")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async reviewVersion(
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @Body() dto: SubmitReviewDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<GovernanceVersionResponse> {
    const version = await this.service.reviewVersion(
      createAuthContext("request-id", principal, tenant),
      tenant.schoolId,
      courseVersionId,
      dto.decision,
      dto.comment,
    );

    return toGovernanceVersionResponse(version);
  }

  @Post(":courseVersionId:publish")
  @RequireRoles(
    MembershipRole.PLATFORM_ADMIN,
    MembershipRole.SCHOOL_ADMIN,
  )
  async publishVersion(
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<GovernanceVersionResponse> {
    const version = await this.service.publishVersion(
      createAuthContext("request-id", principal, tenant),
      tenant.schoolId,
      courseVersionId,
    );

    return toGovernanceVersionResponse(version);
  }

  @Post(":courseVersionId:retire")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async retireVersion(
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<GovernanceVersionResponse> {
    const version = await this.service.retireVersion(
      createAuthContext("request-id", principal, tenant),
      tenant.schoolId,
      courseVersionId,
    );

    return toGovernanceVersionResponse(version);
  }

  @Get(":courseVersionId/reviews")
  @RequireRoles(
    MembershipRole.PLATFORM_ADMIN,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getReviewHistory(
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ readonly items: readonly ReviewDecisionResponse[] }> {
    const decisions = await this.service.getReviewHistory(
      createAuthContext("request-id", principal, tenant),
      tenant.schoolId,
      courseVersionId,
    );

    return {
      items: decisions.map(toReviewDecisionResponse),
    };
  }
}
