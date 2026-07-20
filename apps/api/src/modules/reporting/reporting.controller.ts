import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Body,
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
import { ReportingService } from "./reporting.service.js";
import { CreateReportDto } from "./dto/create-report.dto.js";
import { ListReportsQueryDto } from "./dto/list-reports-query.dto.js";
import { SaveLearningPlanDto } from "./dto/save-learning-plan.dto.js";
import type { ReportType, ReportStatus } from "./domain/report.types.js";

@Controller("schools/:schoolId/reports")
export class ReportingController {
  constructor(
    @Inject(ReportingService)
    private readonly service: ReportingService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async listReports(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListReportsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const { limit = 20, cursor, type, status } = query;
    return this.service.listReports(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { limit, ...(cursor ? { cursor } : {}), ...(type ? { type: type as ReportType } : {}), ...(status ? { status: status as ReportStatus } : {}) },
    );
  }

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateReportDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const { type, periodStart, periodEnd, filters, enrollmentId, classId } = dto;
    return this.service.createReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        type: type as ReportType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        ...(filters ? { filters } : {}),
        ...(enrollmentId ? { enrollmentId } : {}),
        ...(classId ? { classId } : {}),
      },
    );
  }

  @Get(":reportId")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("reportId", ParseUUIDPipe) reportId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      reportId,
    );
  }
}

@Controller("schools/:schoolId/student-growth")
export class StudentGrowthController {
  constructor(
    @Inject(ReportingService)
    private readonly service: ReportingService,
  ) {}

  @Get(":enrollmentId")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getStudentGrowthProfile(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getStudentGrowthProfile(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      enrollmentId,
    );
  }

  @Get(":enrollmentId/learning-plan")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getLearningPlan(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getLearningPlan(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      enrollmentId,
    );
  }

  @Post(":enrollmentId/learning-plan")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async saveLearningPlan(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @Body() dto: SaveLearningPlanDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.saveLearningPlan(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      enrollmentId,
      {
        planContent: dto.planContent,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        ...(dto.expectedRevision != null ? { expectedRevision: dto.expectedRevision } : {}),
      },
    );
  }
}
