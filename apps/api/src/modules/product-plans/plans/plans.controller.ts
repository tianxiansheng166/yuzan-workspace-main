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
import { PlansService } from "./plans.service.js";
import { CreatePlanDto } from "../dto/create-plan.dto.js";
import { UpdatePlanDto } from "../dto/update-plan.dto.js";
import {
  toProductPlanResponse,
  toProductPlanVersionResponse,
  type ProductPlanResponse,
  type ProductPlanVersionResponse,
} from "../dto/plan.response.js";
import type { ProductPlanTier } from "../domain/plan.types.js";
import { PRODUCT_PLAN_TIERS } from "../domain/plan.types.js";

@Controller("api/v1/admin/product-plans")
export class PlansController {
  constructor(
    @Inject(PlansService)
    private readonly service: PlansService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async list(
    @Query("tier") tier?: string,
    @Query("isActive") isActive?: string,
    @Query("limit") limit?: number,
    @Query("cursor") cursor?: string,
    @CurrentTenant() tenant?: TenantContext,
    @CurrentPrincipal() principal?: Principal,
  ) {
    const parsedTier =
      tier && PRODUCT_PLAN_TIERS.includes(tier as ProductPlanTier)
        ? (tier as ProductPlanTier)
        : undefined;
    const parsedIsActive =
      isActive === "true" ? true : isActive === "false" ? false : undefined;
    const parsedLimit = Math.min(Math.max(limit ?? 20, 1), 100);

    const result = await this.service.list(
      createAuthContext("request-id", principal!, tenant!),
      {
        limit: parsedLimit,
        ...(cursor ? { cursor } : {}),
        ...(parsedTier ? { tier: parsedTier } : {}),
        ...(parsedIsActive !== undefined ? { isActive: parsedIsActive } : {}),
      },
    );

    return {
      items: result.items.map(toProductPlanResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async create(
    @Body() dto: CreatePlanDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ProductPlanResponse> {
    const plan = await this.service.create(
      createAuthContext("request-id", principal, tenant),
      dto,
    );
    return toProductPlanResponse(plan);
  }

  @Get(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async findById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ProductPlanResponse> {
    const plan = await this.service.findById(
      createAuthContext("request-id", principal, tenant),
      id,
    );
    return toProductPlanResponse(plan);
  }

  @Patch(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ProductPlanResponse> {
    const plan = await this.service.update(
      createAuthContext("request-id", principal, tenant),
      id,
      dto,
    );
    return toProductPlanResponse(plan);
  }

  @Post(":id:publish-version")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async publishVersion(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ProductPlanVersionResponse> {
    const version = await this.service.publishVersion(
      createAuthContext("request-id", principal, tenant),
      id,
    );
    return toProductPlanVersionResponse(version);
  }

  @Get(":id/versions")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  async listVersions(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ readonly items: readonly ProductPlanVersionResponse[] }> {
    const versions = await this.service.listVersions(
      createAuthContext("request-id", principal, tenant),
      id,
    );
    return {
      items: versions.map(toProductPlanVersionResponse),
    };
  }
}
