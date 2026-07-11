import {
  Body,
  Controller,
  Get,
  Headers,
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
import { SubmissionsService } from "./submissions.service.js";
import { CreateSubmissionDto } from "./dto/create-submission.dto.js";
import { SubmitSubmissionDto } from "./dto/submit-submission.dto.js";
import { ListSubmissionsQueryDto } from "./dto/list-submissions-query.dto.js";

@Controller("schools/:schoolId/submissions")
export class SubmissionsController {
  constructor(
    @Inject(SubmissionsService)
    private readonly service: SubmissionsService,
  ) {}

  @Post()
  @RequireRoles(MembershipRole.STUDENT)
  async createSubmission(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateSubmissionDto,
    @Headers("idempotency-key") idempotencyKey: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createSubmission(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        schoolId,
        assignmentId: dto.assignmentId,
        enrollmentId: dto.enrollmentId,
        idempotencyKey: idempotencyKey ?? "",
      },
    );
  }

  @Get("me")
  @RequireRoles(MembershipRole.STUDENT)
  async listMySubmissions(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listMySubmissions(
      createAuthContext("request-id", principal, tenant),
      schoolId,
    );
  }

  @Get(":submissionId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getSubmission(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getSubmission(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      submissionId,
    );
  }

  @Post(":submissionId/submit")
  @RequireRoles(MembershipRole.STUDENT)
  async submitSubmission(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
    @Body() dto: SubmitSubmissionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submitSubmission(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      submissionId,
      dto.expectedRevision,
    );
  }

  @Post(":submissionId/upload-urls")
  @RequireRoles(MembershipRole.STUDENT)
  async getUploadUrls(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getUploadUrls(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      submissionId,
    );
  }
}

@Controller("schools/:schoolId/assignments/:assignmentId/submissions")
export class AssignmentSubmissionsController {
  constructor(
    @Inject(SubmissionsService)
    private readonly service: SubmissionsService,
  ) {}

  @Get()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listAssignmentSubmissions(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Query() query: ListSubmissionsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/submission-repository.port.js").ListSubmissionsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

    return this.service.listAssignmentSubmissions(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      assignmentId,
      options,
    );
  }
}
