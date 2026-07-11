import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { TrainingService } from "./training.service.js";
import {
  CreateProgramDto,
  EnrollVolunteerDto,
  ListProgramsQueryDto,
  ScheduleExamDto,
  SubmitExamAttemptDto,
  UpdateProgressDto,
  UpdateProgramDto,
} from "./dto/training.dto.js";

@Controller("schools/:schoolId/training")
export class TrainingController {
  constructor(
    @Inject(TrainingService)
    private readonly service: TrainingService,
  ) {}

  // --- Programs ---

  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listPrograms(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListProgramsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/training-repository.port.js").ListProgramsOptions =
      {
        limit: query.limit,
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listPrograms(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get(":programId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getProgram(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("programId", ParseUUIDPipe) programId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getProgram(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      programId,
    );
  }

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createProgram(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateProgramDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createProgram(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto,
    );
  }

  @Put(":programId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async updateProgram(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("programId", ParseUUIDPipe) programId: string,
    @Body() dto: UpdateProgramDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProgram(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      programId,
      dto,
    );
  }

  // --- Enrollments ---

  @Post(":programId/enroll")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async enroll(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("programId", ParseUUIDPipe) programId: string,
    @Body() dto: EnrollVolunteerDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.enroll(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      programId,
      dto.volunteerUserId,
    );
  }

  @Get("enrollments/me")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getMyEnrollments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListProgramsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/training-repository.port.js").ListEnrollmentsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.getMyEnrollments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get("enrollments")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listEnrollments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListProgramsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/training-repository.port.js").ListEnrollmentsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listEnrollments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      "", // programId - list all enrollments for the school
      options,
    );
  }

  // --- Progress ---

  @Post(":programId/progress")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async updateProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("programId", ParseUUIDPipe) _programId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProgress(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      _programId,
      dto.moduleId,
      dto.completed,
      dto.score,
    );
  }

  @Get(":programId/progress")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getProgress(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("programId", ParseUUIDPipe) enrollmentId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getProgress(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      enrollmentId,
    );
  }

  // --- Exams ---

  @Post("exams")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async scheduleExam(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: ScheduleExamDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.scheduleExam(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto.enrollmentId,
      new Date(dto.scheduledAt),
      dto.passingScore,
    );
  }

  @Post("exams/:examId/attempt")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async submitAttempt(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("examId", ParseUUIDPipe) examId: string,
    @Body() dto: SubmitExamAttemptDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submitAttempt(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      examId,
      dto.score,
    );
  }

  @Get("exams/:examId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getExamResults(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("examId", ParseUUIDPipe) examId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getExamResults(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      examId,
    );
  }
}
