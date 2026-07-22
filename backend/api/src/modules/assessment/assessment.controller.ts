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
import { AssessmentService } from "./assessment.service.js";
import { CreateAssessmentSessionDto } from "./dto/create-assessment-session.dto.js";
import { ListSessionsQueryDto } from "./dto/list-sessions-query.dto.js";
import { SaveWrittenAnswerDto, AttachRecordingDto, DeviceCheckDto } from "./dto/assessment-shared.dto.js";

@Controller("schools/:schoolId/assessments/sessions")
export class AssessmentSessionController {
  constructor(
    @Inject(AssessmentService)
    private readonly service: AssessmentService,
  ) {}

  @Post()
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN)
  async createSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateAssessmentSessionDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      { enrollmentId: dto.enrollmentId, classId: dto.classId, type: dto.type, ...(dto.retestOfSessionId ? { retestOfSessionId: dto.retestOfSessionId } : {}) },
    );
  }

  @Get()
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listSessions(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListSessionsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listSessions(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        limit: query.limit ?? 20,
        ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.status ? { status: query.status as "CREATED" | "IN_PROGRESS" | "SUBMITTED" | "PROCESSING" | "COMPLETED" | "CANCELLED" } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    );
  }

  @Get(":sessionId")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  @Post(":sessionId/start")
  @RequireRoles(MembershipRole.STUDENT)
  async startSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.startSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  @Post(":sessionId/submit")
  @RequireRoles(MembershipRole.STUDENT)
  async submitSession(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submitSession(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  // ─── Reading Assessment ────────────────────────────────

  @Get(":sessionId/reading/:itemId")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getReadingItem(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getReadingItem(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      itemId,
    );
  }

  /**
   * GET /schools/:schoolId/assessments/sessions/:sessionId/items
   * List all assessment items for a session (read-only). Used by the student
   * assessment prep page to know which items to attempt without hardcoding IDs.
   */
  @Get(":sessionId/items")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listSessionItems(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listSessionItems(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  @Post(":sessionId/reading/:itemId/recording")
  @RequireRoles(MembershipRole.STUDENT)
  async attachRecording(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: AttachRecordingDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.attachRecording(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      itemId,
      dto.recordingId,
    );
  }

  // ─── Written Assessment ────────────────────────────────

  @Get(":sessionId/written")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getWrittenItems(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getWrittenItems(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  @Put(":sessionId/items/:itemId/answer")
  @RequireRoles(MembershipRole.STUDENT)
  async saveWrittenAnswer(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: SaveWrittenAnswerDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.saveWrittenAnswer(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      itemId,
      dto.content,
      dto.wordCount,
      dto.charCount,
    );
  }

  @Post(":sessionId/items/:itemId/answer/finalize")
  @RequireRoles(MembershipRole.STUDENT)
  async finalizeAnswer(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.finalizeAnswer(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      itemId,
    );
  }

  // ─── Report ────────────────────────────────────────────

  @Get(":sessionId/report")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  @Post(":sessionId/report/generate")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async generateReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.generateReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }

  // ─── Teacher Review ──────────────────────────────────────

  @Put(":sessionId/items/:itemId/review")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async reviewItem(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() body: { scoredScore?: number; reviewerComment?: string },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviewItem(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      itemId,
      body,
    );
  }

  @Get(":sessionId/items/:itemId/recording")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getItemRecordingEvidence(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getItemRecordingEvidence(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      itemId,
    );
  }

  // ─── Retest ────────────────────────────────────────────

  @Post(":sessionId/retest")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async scheduleRetest(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.scheduleRetest(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
    );
  }
}

@Controller("schools/:schoolId/assessments")
export class AssessmentDeviceController {
  constructor(
    @Inject(AssessmentService)
    private readonly service: AssessmentService,
  ) {}

  @Post("device-check")
  @RequireRoles(MembershipRole.STUDENT)
  async deviceCheck(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: DeviceCheckDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.logDeviceCheck(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      "microphone",
      dto.checkResult,
      dto.userAgent,
    );
  }

  @Get("history")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getAssessmentHistory(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("enrollmentId") enrollmentId: string | undefined,
    @Query("range") range: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAssessmentHistory(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        ...(enrollmentId ? { enrollmentId } : {}),
        ...(range ? { range: range as "8w" | "6m" | "all" } : {}),
      },
    );
  }

  @Get("history/events")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getAssessmentHistoryEvents(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query("enrollmentId") enrollmentId: string | undefined,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAssessmentHistoryEvents(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      enrollmentId,
    );
  }

  @Post("sessions/:sessionId/export")
  @RequireRoles(MembershipRole.STUDENT, MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async exportReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: { purpose?: string },
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.exportReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      sessionId,
      body.purpose,
    );
  }
}
