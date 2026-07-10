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
import { CurriculumService } from "./curriculum.service.js";
import { CreateCourseDraftDto } from "./dto/create-course-draft.dto.js";
import { ListCourseVersionsQueryDto } from "./dto/list-course-versions-query.dto.js";
import type { CourseVersionSummaryResponse } from "./dto/course-version-summary.response.js";

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

  @Post(":courseVersionId:publish")
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
}
