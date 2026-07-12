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
} from "../../../common/security/index.js";
import { LinksService } from "./links.service.js";
import {
  toAssessmentLinkResponse,
  type AssessmentLinkResponse,
} from "../dto/link.response.js";
import { RegenerateLinkDto } from "../dto/regenerate-link.dto.js";
import type { AssessmentLinkStatus } from "../domain/link.types.js";
import { ASSESSMENT_LINK_STATUSES } from "../domain/link.types.js";

@Controller("api/v1/admin/schools/:schoolId/assessment-links")
export class LinksController {
  constructor(
    @Inject(LinksService)
    private readonly service: LinksService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async list(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("assignmentId") assignmentId?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: number,
    @Query("cursor") cursor?: string,
    @CurrentTenant() tenant?: TenantContext,
    @CurrentPrincipal() principal?: Principal,
  ) {
    const parsedStatus =
      status &&
      ASSESSMENT_LINK_STATUSES.includes(status as AssessmentLinkStatus)
        ? (status as AssessmentLinkStatus)
        : undefined;
    const parsedLimit = Math.min(Math.max(limit ?? 20, 1), 100);

    const result = await this.service.list(
      createAuthContext("request-id", principal!, tenant!),
      {
        schoolId,
        ...(assignmentId ? { assignmentId } : {}),
        limit: parsedLimit,
        ...(cursor ? { cursor } : {}),
        ...(parsedStatus ? { status: parsedStatus } : {}),
      },
    );

    return {
      items: result.items.map(toAssessmentLinkResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  @Get(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async findById(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AssessmentLinkResponse> {
    const link = await this.service.findById(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
    );
    return toAssessmentLinkResponse(link);
  }

  @Post(":id:disable")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async disable(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AssessmentLinkResponse> {
    const link = await this.service.disable(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
    );
    return toAssessmentLinkResponse(link);
  }

  @Post(":id:regenerate")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async regenerate(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RegenerateLinkDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AssessmentLinkResponse> {
    const link = await this.service.regenerate(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
      dto,
    );
    return toAssessmentLinkResponse(link);
  }
}
