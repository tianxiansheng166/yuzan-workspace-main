import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
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
import { RecordingsService } from "./recordings.service.js";
import { InitRecordingDto, InitSimpleRecordingDto } from "./dto/init-recording.dto.js";
import { CompleteRecordingDto } from "./dto/complete-recording.dto.js";

@Controller("schools/:schoolId/recordings")
export class RecordingsController {
  constructor(
    @Inject(RecordingsService)
    private readonly service: RecordingsService,
  ) {}

  @Post()
  @RequireRoles(MembershipRole.STUDENT)
  async initRecording(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: InitRecordingDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.initRecording(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        schoolId,
        enrollmentId: dto.enrollmentId,
        ...(dto.submissionId ? { submissionId: dto.submissionId } : {}),
        partCount: dto.partCount,
        ...(dto.mimeType ? { mimeType: dto.mimeType } : {}),
        ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
      },
    );
  }


  @Post("simple")
  @RequireRoles(MembershipRole.STUDENT)
  async initSimpleRecording(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: InitSimpleRecordingDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.initSimpleRecording(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        schoolId,
        enrollmentId: dto.enrollmentId,
        ...(dto.submissionId ? { submissionId: dto.submissionId } : {}),
        ...(dto.mimeType ? { mimeType: dto.mimeType } : {}),
        ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
      },
    );
  }

  @Post(":recordingId/parts/:partNumber/upload-url")
  @RequireRoles(MembershipRole.STUDENT)
  async uploadPart(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @Param("partNumber", ParseIntPipe) partNumber: number,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.uploadPart(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      recordingId,
      partNumber,
    );
  }

  @Post(":recordingId/complete")
  @RequireRoles(MembershipRole.STUDENT)
  async completeRecording(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @Body() dto: CompleteRecordingDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.completeRecording(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      recordingId,
      {
        ...(dto.durationMs != null ? { durationMs: dto.durationMs } : {}),
        ...(dto.objectKey != null ? { objectKey: dto.objectKey } : {}),
        ...(dto.assessmentItemId != null ? { assessmentItemId: dto.assessmentItemId } : {}),
        ...(dto.targetText != null ? { targetText: dto.targetText } : {}),
      },
    );
  }

  @Get(":recordingId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getRecordingStatus(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getRecordingStatus(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      recordingId,
    );
  }

  @Get(":recordingId/evidence")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async getRecordingEvidence(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("recordingId", ParseUUIDPipe) recordingId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getRecordingEvidence(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      recordingId,
    );
  }
}
