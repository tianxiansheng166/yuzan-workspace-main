import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto.js";
import { PresignUploadDto } from "./dto/presign-upload.dto.js";
import { ResourcesService } from "./resources.service.js";

@Controller("schools/:schoolId/resources")
export class ResourcesController {
  constructor(@Inject(ResourcesService) private readonly service: ResourcesService) {}

  @Post("presign-upload")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  presignUpload(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: PresignUploadDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.presignUpload(createAuthContext("request-id", principal, tenant), schoolId, dto);
  }

  @Put(":resourceId/confirm-upload")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  confirmUpload(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.confirmUpload(createAuthContext("request-id", principal, tenant), schoolId, resourceId, dto);
  }

  @Get(":resourceId/playback-url")
  getPlaybackUrl(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getPlaybackUrl(createAuthContext("request-id", principal, tenant), schoolId, resourceId);
  }

  @Get(":resourceId")
  getInfo(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("resourceId", ParseUUIDPipe) resourceId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getResourceInfo(createAuthContext("request-id", principal, tenant), schoolId, resourceId);
  }
}
