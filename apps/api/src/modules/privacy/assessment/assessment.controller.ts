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
import { AssessmentService } from "./assessment.service.js";
import { CreateMaterialDto } from "../dto/create-material.dto.js";
import { UpdateMaterialDto } from "../dto/update-material.dto.js";
import type { AssessmentMaterialType, AssessmentMaterialStatus } from "../domain/assessment.types.js";

@Controller("api/v1/admin/schools/:schoolId/assessment-materials")
export class AssessmentController {
  constructor(
    @Inject(AssessmentService)
    private readonly service: AssessmentService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async list(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("limit") limit: number = 20,
    @Query("cursor") cursor: string | undefined,
    @Query("type") type: AssessmentMaterialType | undefined,
    @Query("status") status: AssessmentMaterialStatus | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(
      createAuthContext("request-id", principal, tenant),
      {
        schoolId,
        limit,
        ...(cursor ? { cursor } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
    );
  }

  @Post()
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async create(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateMaterialDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Patch(":id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async update(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaterialDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.update(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
      dto,
    );
  }

  @Post(":id:preview")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async preview(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.preview(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
    );
  }

  @Post(":id:publish")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async publish(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.publish(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
    );
  }

  @Post(":id:archive")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  async archive(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.archive(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      id,
    );
  }
}
