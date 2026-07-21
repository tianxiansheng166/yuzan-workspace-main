import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { ClassesService } from "./classes.service.js";
import { CreateClassDto } from "./dto/create-class.dto.js";
import { UpdateClassDto } from "./dto/update-class.dto.js";
import { AddEnrollmentDto } from "./dto/add-enrollment.dto.js";
import { ListClassesQueryDto } from "./dto/list-classes-query.dto.js";
import { SupplementaryPracticeDto } from "./dto/supplementary-practice.dto.js";
import { ClassAssessmentDto } from "./dto/class-assessment.dto.js";
import { ImportStudentsDto } from "./dto/import-students.dto.js";
import { toEnrollmentResponse } from "./dto/enrollment.response.js";

@Controller("schools/:schoolId/classes")
export class ClassesController {
  constructor(
    @Inject(ClassesService)
    private readonly service: ClassesService,
  ) {}

  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listClasses(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListClassesQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/class-repository.port.js").ListClassesOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listClasses(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async createClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateClassDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { ...dto, schoolId },
    );
  }

  @Get(":classId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Post(":classId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async updateClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: UpdateClassDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.grade ? { grade: dto.grade } : {}),
      },
      new Date(dto.expectedUpdatedAt),
    );
  }

  @Delete(":classId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @HttpCode(204)
  async deleteClass(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    await this.service.deleteClass(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/detail")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getClassDetail(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getClassDetail(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/pending-stats")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getClassPendingStats(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getClassPendingStats(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/dashboard")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getClassDashboard(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getClassDashboard(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/student-summaries")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getStudentSummaries(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getStudentSummaries(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/assignment-summaries")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getAssignmentSummaries(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAssignmentSummaries(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/assessment-summaries")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async getAssessmentSummaries(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAssessmentSummaries(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get(":classId/export")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async exportClassData(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Query("format") format: string = "json",
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.exportClassData(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      format ?? "json",
    );
  }

  @Get(":classId/members")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listClassMembers(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listClassMembers(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
  }

  @Get("teachers/me")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listMyTeacherClasses(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMyClasses(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get("students/me")
  @RequireRoles(MembershipRole.STUDENT)
  async listMyStudentClasses(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMyClasses(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":classId/enrollments")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listEnrollments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const enrollments = await this.service.listEnrollments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
    );
    return enrollments.map(toEnrollmentResponse);
  }

  @Post(":classId/supplementary-practice")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createSupplementaryPractice(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: SupplementaryPracticeDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createSupplementaryPractice(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      dto,
    );
  }

  @Post(":classId/assessments")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createClassAssessment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: ClassAssessmentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createClassAssessment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      {
        type: dto.type,
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.enrollmentIds !== undefined ? { targetEnrollmentIds: dto.enrollmentIds } : {}),
        ...(dto.questionIds !== undefined ? { questionIds: dto.questionIds } : {}),
      },
    );
  }

  @Post(":classId/enrollments")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN, MembershipRole.TEACHER)
  async addEnrollment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: AddEnrollmentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.addEnrollment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      dto.userId,
      dto.role,
    );
  }

  @Post(":classId/students/import")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async importStudents(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: ImportStudentsDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.importStudents(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      dto.students,
    );
  }

  @Delete(":classId/enrollments/:enrollmentId")
  @RequireRoles(MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @HttpCode(204)
  async removeEnrollment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Param("enrollmentId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    await this.service.removeEnrollment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      classId,
      enrollmentId,
    );
  }
}
