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
import { FeedbackService } from "./feedback.service.js";
import { CreateFeedbackDto } from "./dto/create-feedback.dto.js";
import { ListFeedbackQueryDto } from "./dto/list-feedback-query.dto.js";

@Controller("schools/:schoolId/submissions/:submissionId/feedback")
export class SubmissionFeedbackController {
  constructor(
    @Inject(FeedbackService)
    private readonly service: FeedbackService,
  ) {}

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async createFeedback(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createFeedback(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      submissionId,
      {
        decision: dto.decision,
        comment: dto.comment,
        ...(dto.score !== undefined ? { score: dto.score } : {}),
      },
    );
  }

  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listFeedback(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getFeedbackBySubmission(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      submissionId,
    );
  }
}

@Controller("schools/:schoolId/feedback")
export class SchoolFeedbackController {
  constructor(
    @Inject(FeedbackService)
    private readonly service: FeedbackService,
  ) {}

  @Get("pending")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listPendingFeedback(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListFeedbackQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listPendingFeedback(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    );
  }
}
