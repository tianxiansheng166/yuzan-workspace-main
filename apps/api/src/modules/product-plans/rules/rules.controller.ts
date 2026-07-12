import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { RulesService } from "./rules.service.js";
import { CreateRuleDto } from "../dto/create-rule.dto.js";
import { UpdateRuleDto } from "../dto/update-rule.dto.js";
import {
  toRecommendationRuleResponse,
  type RecommendationRuleResponse,
} from "../dto/rule.response.js";
import {
  toRuleConflictResponse,
  type RuleConflictResponse,
} from "../dto/conflict.response.js";
import type { RecommendationRuleStatus } from "../domain/rule.types.js";
import { RECOMMENDATION_RULE_STATUSES } from "../domain/rule.types.js";

@Controller("api/v1/admin/recommendation-rules")
export class RulesController {
  constructor(
    @Inject(RulesService)
    private readonly service: RulesService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async list(
    @Query("status") status?: string,
    @Query("issueCode") issueCode?: string,
    @Query("dimensionCode") dimensionCode?: string,
    @Query("limit") limit?: number,
    @Query("cursor") cursor?: string,
    @CurrentTenant() tenant?: TenantContext,
    @CurrentPrincipal() principal?: Principal,
  ) {
    const parsedStatus =
      status &&
      RECOMMENDATION_RULE_STATUSES.includes(status as RecommendationRuleStatus)
        ? (status as RecommendationRuleStatus)
        : undefined;
    const parsedLimit = Math.min(Math.max(limit ?? 20, 1), 100);

    const result = await this.service.list(
      createAuthContext("request-id", principal!, tenant!),
      {
        limit: parsedLimit,
        ...(cursor ? { cursor } : {}),
        ...(parsedStatus ? { status: parsedStatus } : {}),
        ...(issueCode ? { issueCode } : {}),
        ...(dimensionCode ? { dimensionCode } : {}),
      },
    );

    return {
      items: result.items.map(toRecommendationRuleResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async create(
    @Body() dto: CreateRuleDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RecommendationRuleResponse> {
    const rule = await this.service.create(
      createAuthContext("request-id", principal, tenant),
      dto,
    );
    return toRecommendationRuleResponse(rule);
  }

  @Get(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async findById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RecommendationRuleResponse> {
    const rule = await this.service.findById(
      createAuthContext("request-id", principal, tenant),
      id,
    );
    return toRecommendationRuleResponse(rule);
  }

  @Patch(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RecommendationRuleResponse> {
    const rule = await this.service.update(
      createAuthContext("request-id", principal, tenant),
      id,
      dto,
    );
    return toRecommendationRuleResponse(rule);
  }

  @Post(":id:publish")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async publish(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RecommendationRuleResponse> {
    const rule = await this.service.publish(
      createAuthContext("request-id", principal, tenant),
      id,
    );
    return toRecommendationRuleResponse(rule);
  }

  @Post(":id:archive")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async archive(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RecommendationRuleResponse> {
    const rule = await this.service.archive(
      createAuthContext("request-id", principal, tenant),
      id,
    );
    return toRecommendationRuleResponse(rule);
  }

  @Post(":detect-conflicts")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async detectConflicts(
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ readonly items: readonly RuleConflictResponse[] }> {
    const conflicts = await this.service.detectConflictsForAll(
      createAuthContext("request-id", principal, tenant),
    );
    return {
      items: conflicts.map(toRuleConflictResponse),
    };
  }
}
