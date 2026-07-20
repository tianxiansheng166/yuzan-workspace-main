import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
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
import { CurriculumService } from "./curriculum.service.js";
import { CreateCourseDraftDto } from "./dto/create-course-draft.dto.js";
import { ListCourseVersionsQueryDto } from "./dto/list-course-versions-query.dto.js";
import type { CourseVersionSummaryResponse } from "./dto/course-version-summary.response.js";
import { UpdateCourseDraftDto } from "./dto/update-course-draft.dto.js";
import { SubmitReviewDto } from "./dto/submit-review.dto.js";
import { AttachResourceDto } from "./dto/attach-resource.dto.js";
import { AttachOfflinePackageDto } from "./dto/attach-offline-package.dto.js";

@Controller("schools/:schoolId/course-versions")
export class CurriculumController {
  constructor(
    @Inject(CurriculumService)
    private readonly service: CurriculumService,
  ) {}

  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listCourseVersions(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListCourseVersionsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<readonly CourseVersionSummaryResponse[]> {
    return this.service.listCourseVersions(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      query,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createCourseDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateCourseDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<CourseVersionSummaryResponse> {
    return this.service.createCourseDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Get(":courseVersionId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getCourseDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.findById(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
    );
  }

  @Patch(":courseVersionId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateCourseDraft(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @Body() dto: UpdateCourseDraftDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateDraft(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
      dto,
    );
  }

  @Post(":courseVersionId/publish")
  @HttpCode(HttpStatus.OK)
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async publishCourseVersion(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<CourseVersionSummaryResponse> {
    return this.service.publishCourseVersion(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
    );
  }

  @Post(":courseVersionId/submit-review")
  @HttpCode(HttpStatus.OK)
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async submitForReview(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @Body() dto: SubmitReviewDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ): Promise<CourseVersionSummaryResponse> {
    return this.service.submitForReview(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
    );
  }

  @Post(":courseVersionId/resources")
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async attachResource(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @Body() dto: AttachResourceDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.attachResource(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
      dto,
    );
  }

  @Get(":courseVersionId/resources")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listResources(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listResources(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
    );
  }

  @Post(":courseVersionId/offline-packages")
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async attachOfflinePackage(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("courseVersionId", ParseUUIDPipe) courseVersionId: string,
    @Body() dto: AttachOfflinePackageDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.attachOfflinePackage(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      courseVersionId,
      dto,
    );
  }
}
