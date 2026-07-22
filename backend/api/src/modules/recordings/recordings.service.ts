import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { StoragePort } from "../../shared/storage/storage.port.js";
import { STORAGE_PORT } from "../../shared/storage/storage.port.js";
import type {
  InitRecordingInput,
  CompleteRecordingInput,
  Recording,
} from "./domain/recording.types.js";
import {
  RecordingForbiddenException,
  RecordingNotFoundException,
  RecordingStatusException,
} from "./domain/recording.errors.js";
import type {
  RecordingRepositoryPort,
} from "./ports/recording-repository.port.js";
import { RECORDING_REPOSITORY } from "./ports/recording-repository.port.js";
import {
  toInitRecordingResponse,
  toInitSimpleRecordingResponse,
  toRecordingStatusResponse,
  toRecordingEvidenceResponse,
} from "./dto/recording.response.js";
import { RecordingsPolicy } from "./recordings.policy.js";
import { SpeechJobService } from "../speech-job/speech-job.service.js";

@Injectable()
export class RecordingsService {
  private readonly policy = new RecordingsPolicy();
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    @Inject(RECORDING_REPOSITORY)
    private readonly recordingRepo: RecordingRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Optional() @Inject(SpeechJobService)
    private readonly speechJobService: SpeechJobService | null,
  ) {}

  async initRecording(
    auth: AuthContext,
    schoolId: string,
    input: InitRecordingInput,
  ) {
    if (!this.policy.canInitRecording(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    // Verify enrollment belongs to current student
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: input.enrollmentId,
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
        role: "STUDENT",
      },
    });
    if (!enrollment) {
      throw new RecordingForbiddenException();
    }

    // Idempotent: if a recording with this idempotencyKey already exists,
    // return the existing one with upload URLs
    if (input.idempotencyKey) {
      const existing = await this.recordingRepo.findByIdempotencyKey(
        input.enrollmentId,
        input.idempotencyKey,
      );
      if (existing) {
        const uploadUrls = await this.generateUploadUrls(
          existing.id,
          existing.partCount,
          input.mimeType,
        );
        return toInitRecordingResponse(existing, uploadUrls);
      }
    }

    const recording = await this.recordingRepo.save({
      ...input,
      schoolId,
    });

    // Generate presigned upload URLs for each part
    const uploadUrls = await this.generateUploadUrls(
      recording.id,
      recording.partCount,
      input.mimeType,
    );

    return toInitRecordingResponse(recording, uploadUrls);
  }


  async initSimpleRecording(
    auth: AuthContext,
    schoolId: string,
    input: Omit<InitRecordingInput, "partCount">,
  ) {
    if (!this.policy.canInitRecording(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    // Verify enrollment belongs to current student
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: input.enrollmentId,
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
        role: "STUDENT",
      },
    });
    if (!enrollment) {
      throw new RecordingForbiddenException();
    }

    // Idempotent: if a recording with this idempotencyKey already exists,
    // return the existing one with upload URL
    if (input.idempotencyKey) {
      const existing = await this.recordingRepo.findByIdempotencyKey(
        input.enrollmentId,
        input.idempotencyKey,
      );
      if (existing) {
        const objectKey = `recordings/${existing.id}/full`;
        const uploadUrl = await this.storage.generateUploadUrl(
          objectKey,
          input.mimeType ?? "audio/webm",
        );
        return toInitSimpleRecordingResponse(existing, uploadUrl);
      }
    }

    // Simple recording: partCount=1, single file upload
    const recording = await this.recordingRepo.save({
      ...input,
      schoolId,
      partCount: 1,
    });

    // Generate a single presigned PUT URL for the whole file
    const objectKey = `recordings/${recording.id}/full`;
    const uploadUrl = await this.storage.generateUploadUrl(
      objectKey,
      input.mimeType ?? "audio/webm",
    );

    // Mark part 0 as "expected" so completeRecording can validate
    return toInitSimpleRecordingResponse(recording, uploadUrl);
  }

  async uploadPart(
    auth: AuthContext,
    schoolId: string,
    recordingId: string,
    partNumber: number,
  ) {
    if (!this.policy.canUploadPart(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    const recording = await this.recordingRepo.findById(schoolId, recordingId);
    if (!recording) {
      throw new RecordingNotFoundException();
    }

    // Verify ownership
    await this.verifyEnrollmentOwnership(auth, schoolId, recording.enrollmentId);

    // Validate state: can only upload parts when INITIALIZED or UPLOADING
    if (
      recording.status !== "INITIALIZED" &&
      recording.status !== "UPLOADING"
    ) {
      throw new RecordingStatusException(
        `当前状态 ${recording.status} 不允许上传分片`,
      );
    }

    // Validate part number
    if (partNumber < 1 || partNumber > recording.partCount) {
      throw new RecordingStatusException(
        `分片编号 ${partNumber} 超出范围 (1-${recording.partCount})`,
      );
    }

    // Generate presigned upload URL for this specific part
    const objectKey = `recordings/${recordingId}/part-${partNumber}`;
    const uploadUrl = await this.storage.generateUploadUrl(
      objectKey,
      recording.mimeType ?? "audio/webm",
    );

    // Update uploaded parts list (optimistic concurrency)
    await this.recordingRepo.updateUploadedParts(
      schoolId,
      recordingId,
      partNumber,
      recording.revision,
    );

    return {
      recordingId,
      partNumber,
      uploadUrl: uploadUrl.url,
      objectKey: uploadUrl.objectKey,
      expiresInSeconds: uploadUrl.expiresInSeconds,
    };
  }

  async completeRecording(
    auth: AuthContext,
    schoolId: string,
    recordingId: string,
    input: CompleteRecordingInput,
  ) {
    if (!this.policy.canCompleteRecording(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    const recording = await this.recordingRepo.findById(schoolId, recordingId);
    if (!recording) {
      throw new RecordingNotFoundException();
    }

    // Verify ownership
    await this.verifyEnrollmentOwnership(auth, schoolId, recording.enrollmentId);

    // Validate state: can only complete when UPLOADING
    if (recording.status !== "UPLOADING" && recording.status !== "INITIALIZED") {
      throw new RecordingStatusException(
        `当前状态 ${recording.status} 不允许完成录音`,
      );
    }

    // Simple recording (partCount=1): verify file exists via headObject
    // Note: simple flow uploads directly to presigned URL, so uploadedParts may be empty
    let completedRecording: Recording;

    if (recording.partCount === 1) {
      const objectKey = input.objectKey ?? `recordings/${recordingId}/full`;
      const headResult = await this.storage.headObject(objectKey);

      if (!headResult.exists) {
        throw new RecordingStatusException(
          "上传文件不存在，无法完成录音",
        );
      }
      if (headResult.contentLength != null && headResult.contentLength === 0) {
        throw new RecordingStatusException(
          "上传文件大小为0，无法完成录音",
        );
      }

      // Set objectKey for the simple recording so it can be downloaded later
      completedRecording = await this.recordingRepo.completeRecording(
        schoolId,
        recordingId,
        {
          ...input,
          objectKey,
        },
        recording.revision,
      );
    } else {
      // Chunked recording: verify all parts have been uploaded
      const allPartsUploaded = Array.from(
        { length: recording.partCount },
        (_, i) => i + 1,
      ).every((p) => recording.uploadedParts.includes(p));

      if (!allPartsUploaded) {
        const missingParts = Array.from(
          { length: recording.partCount },
          (_, i) => i + 1,
        ).filter((p) => !recording.uploadedParts.includes(p));
        throw new RecordingStatusException(
          `录音分片未全部上传，无法完成录音。缺失分片: ${missingParts.join(", ")}`,
        );
      }

      completedRecording = await this.recordingRepo.completeRecording(
        schoolId,
        recordingId,
        {
          ...input,
        },
        recording.revision,
      );
    }

    // ─── Auto-trigger SpeechJob if targetText is provided ───
    if (
      input.targetText &&
      this.speechJobService
    ) {
      try {
        const speechJob = await this.speechJobService.triggerSpeechProcessing(
          recordingId,
          input.assessmentItemId,
          input.targetText,
          schoolId,
        );
        this.logger.log(
          `SpeechJob auto-triggered after recording completion: jobId=${speechJob.id} recordingId=${recordingId}`,
        );
      } catch (err: unknown) {
        // Speech processing failure should NOT block recording completion.
        // The recording is already COMPLETE; the job will need manual retry.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to auto-trigger SpeechJob for recording ${recordingId}: ${message}`,
        );
      }
    }

    return toRecordingStatusResponse(completedRecording);
  }

  async getRecordingStatus(
    auth: AuthContext,
    schoolId: string,
    recordingId: string,
  ) {
    if (!this.policy.canReadRecording(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    const recording = await this.recordingRepo.findById(schoolId, recordingId);
    if (!recording) {
      throw new RecordingNotFoundException();
    }

    // Students can only see their own recordings
    await this.verifyEnrollmentOwnership(auth, schoolId, recording.enrollmentId);

    return toRecordingStatusResponse(recording);
  }

  /** Student-facing recording archive. It is scoped by the active enrollment,
   * so another school's or student's recording can never enter this list. */
  async listMyAssessmentRecordings(auth: AuthContext, schoolId: string) {
    if (!this.policy.canReadRecording(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { schoolId, userId: auth.principal.userId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) throw new RecordingForbiddenException();

    const items = await this.prisma.assessmentItem.findMany({
      where: {
        recordingId: { not: null },
        session: { schoolId, enrollmentId: enrollment.id },
      },
      include: {
        recording: { select: { id: true, status: true, durationMs: true, mimeType: true, createdAt: true } },
        session: { select: { id: true, status: true, completedAt: true, practiceDefinitionId: true } },
        speechJobs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, errorCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return items.flatMap((item) => {
      if (!item.recording) return [];
      const prompt = item.prompt && typeof item.prompt === "object" ? item.prompt as Record<string, unknown> : {};
      return [{
        recordingId: item.recording.id,
        sessionId: item.session.id,
        label: typeof prompt.title === "string" ? prompt.title : `第 ${item.sortOrder + 1} 段练习录音`,
        itemType: item.itemType,
        recordingStatus: item.recording.status,
        durationMs: item.recording.durationMs,
        createdAt: item.recording.createdAt.toISOString(),
        attemptStatus: item.session.status,
        completedAt: item.session.completedAt?.toISOString() ?? null,
        speechStatus: item.speechJobs[0]?.status ?? null,
        speechErrorCode: item.speechJobs[0]?.errorCode ?? null,
      }];
    });
  }

  async getRecordingEvidence(
    auth: AuthContext,
    schoolId: string,
    recordingId: string,
  ) {
    if (!this.policy.canViewEvidence(auth, schoolId)) {
      throw new RecordingForbiddenException();
    }

    const recording = await this.recordingRepo.findById(schoolId, recordingId);
    if (!recording) {
      throw new RecordingNotFoundException();
    }

    // Only generate download URL if recording is in a ready state
    if (recording.status !== "COMPLETE" && recording.status !== "PROCESSING" && recording.status !== "READY") {
      throw new RecordingStatusException(
        `当前状态 ${recording.status} 不允许下载`,
      );
    }

    // Use the recording's objectKey or construct one from the recording ID
    const objectKey = recording.objectKey ?? `recordings/${recordingId}`;
    const downloadUrl = await this.storage.generateDownloadUrl(objectKey);

    return toRecordingEvidenceResponse(recording, downloadUrl.url);
  }

  private async verifyEnrollmentOwnership(
    auth: AuthContext,
    schoolId: string,
    enrollmentId: string,
  ): Promise<void> {
    // PLATFORM_ADMIN can access any recording
    if (this.policy.canViewEvidence(auth, schoolId)) {
      // For TEACHER/SCHOOL_ADMIN roles, skip ownership check
      const isStudent = auth.principal.roles.includes("STUDENT" as never);
      if (!isStudent) return;
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
      },
    });
    if (!enrollment) {
      throw new RecordingForbiddenException();
    }
  }

  private async generateUploadUrls(
    recordingId: string,
    partCount: number,
    mimeType?: string,
  ) {
    const urls = [];
    for (let i = 1; i <= partCount; i++) {
      const objectKey = `recordings/${recordingId}/part-${i}`;
      const url = await this.storage.generateUploadUrl(
        objectKey,
        mimeType ?? "audio/webm",
      );
      urls.push(url);
    }
    return urls;
  }
}
