import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import type {
  Recording,
  RecordingStatus,
  InitRecordingInput,
  CompleteRecordingInput,
} from "../domain/recording.types.js";
import {
  RecordingConflictException,
  RecordingUnavailableException,
} from "../domain/recording.errors.js";
import type {
  ListRecordingsOptions,
  PaginatedResult,
  RecordingRepositoryPort,
} from "../ports/recording-repository.port.js";

type RecordingRow = Prisma.RecordingGetPayload<Record<string, never>>;

@Injectable()
export class PrismaRecordingRepository implements RecordingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    schoolId: string,
    recordingId: string,
  ): Promise<Recording | null> {
    try {
      const row = await this.prisma.recording.findFirst({
        where: { id: recordingId, schoolId },
      });
      return row ? toRecording(row) : null;
    } catch {
      throw new RecordingUnavailableException("录音查询失败");
    }
  }

  async findByIdempotencyKey(
    enrollmentId: string,
    idempotencyKey: string,
  ): Promise<Recording | null> {
    try {
      const row = await this.prisma.recording.findFirst({
        where: { enrollmentId, idempotencyKey },
      });
      return row ? toRecording(row) : null;
    } catch {
      throw new RecordingUnavailableException("录音查询失败");
    }
  }

  async findBySubmissionId(
    schoolId: string,
    submissionId: string,
  ): Promise<readonly Recording[]> {
    try {
      const rows = await this.prisma.recording.findMany({
        where: { schoolId, submissionId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toRecording);
    } catch {
      throw new RecordingUnavailableException("录音查询失败");
    }
  }

  async listByEnrollment(
    schoolId: string,
    enrollmentId: string,
    options?: ListRecordingsOptions,
  ): Promise<PaginatedResult<Recording>> {
    try {
      const where: Prisma.RecordingWhereInput = {
        schoolId,
        enrollmentId,
      };

      if (options?.status) {
        where.status = options.status;
      }

      if (options?.cursor) {
        where.id = { gt: options.cursor };
      }

      const limit = options?.limit ?? 20;

      const rows = await this.prisma.recording.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      const nextCursor = hasMore
        ? items[items.length - 1]?.id ?? null
        : null;

      return {
        items: items.map(toRecording),
        nextCursor,
        hasMore,
      };
    } catch {
      throw new RecordingUnavailableException("录音查询失败");
    }
  }

  async save(input: InitRecordingInput): Promise<Recording> {
    try {
      const row = await this.prisma.recording.create({
        data: {
          schoolId: input.schoolId,
          enrollmentId: input.enrollmentId,
          ...(input.submissionId ? { submissionId: input.submissionId } : {}),
          status: "INITIALIZED",
          partCount: input.partCount,
          ...(input.mimeType ? { mimeType: input.mimeType } : {}),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          revision: 1,
        },
      });
      return toRecording(row);
    } catch (err) {
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new RecordingConflictException();
      }
      throw new RecordingUnavailableException("录音创建失败");
    }
  }

  async updateStatus(
    schoolId: string,
    recordingId: string,
    status: RecordingStatus,
    expectedRevision: number,
  ): Promise<Recording> {
    try {
      const result = await this.prisma.recording.updateMany({
        where: {
          id: recordingId,
          schoolId,
          revision: expectedRevision,
        },
        data: {
          status,
          revision: expectedRevision + 1,
        },
      });

      if (result.count !== 1) {
        throw new RecordingConflictException();
      }

      return (await this.findById(schoolId, recordingId))!;
    } catch (err) {
      if (
        err instanceof RecordingConflictException ||
        err instanceof RecordingUnavailableException
      ) {
        throw err;
      }
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new RecordingConflictException();
      }
      throw new RecordingUnavailableException("录音状态更新失败");
    }
  }

  async updateUploadedParts(
    schoolId: string,
    recordingId: string,
    partNumber: number,
    expectedRevision: number,
  ): Promise<Recording> {
    try {
      const current = await this.findById(schoolId, recordingId);
      if (!current) {
        throw new RecordingConflictException();
      }

      if (current.revision !== expectedRevision) {
        throw new RecordingConflictException();
      }

      const mergedParts = Array.from(
        new Set([...current.uploadedParts, partNumber]),
      ).sort((a, b) => a - b);

      const newStatus: RecordingStatus =
        current.status === "INITIALIZED" ? "UPLOADING" : current.status;

      const result = await this.prisma.recording.updateMany({
        where: {
          id: recordingId,
          schoolId,
          revision: expectedRevision,
        },
        data: {
          status: newStatus,
          uploadedParts: mergedParts,
          revision: expectedRevision + 1,
        },
      });

      if (result.count !== 1) {
        throw new RecordingConflictException();
      }

      return (await this.findById(schoolId, recordingId))!;
    } catch (err) {
      if (
        err instanceof RecordingConflictException ||
        err instanceof RecordingUnavailableException
      ) {
        throw err;
      }
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new RecordingConflictException();
      }
      throw new RecordingUnavailableException("录音分片更新失败");
    }
  }

  async completeRecording(
    schoolId: string,
    recordingId: string,
    input: CompleteRecordingInput,
    expectedRevision: number,
  ): Promise<Recording> {
    try {
      const result = await this.prisma.recording.updateMany({
        where: {
          id: recordingId,
          schoolId,
          revision: expectedRevision,
        },
        data: {
          status: "COMPLETE",
          ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
          ...(input.objectKey != null ? { objectKey: input.objectKey } : {}),
          revision: expectedRevision + 1,
        },
      });

      if (result.count !== 1) {
        throw new RecordingConflictException();
      }

      return (await this.findById(schoolId, recordingId))!;
    } catch (err) {
      if (
        err instanceof RecordingConflictException ||
        err instanceof RecordingUnavailableException
      ) {
        throw err;
      }
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new RecordingConflictException();
      }
      throw new RecordingUnavailableException("录音完成操作失败");
    }
  }
}

function toRecording(row: RecordingRow): Recording {
  return {
    id: row.id,
    schoolId: row.schoolId,
    enrollmentId: row.enrollmentId,
    ...(row.submissionId ? { submissionId: row.submissionId } : {}),
    status: row.status as RecordingStatus,
    partCount: row.partCount,
    uploadedParts: row.uploadedParts,
    ...(row.durationMs ? { durationMs: row.durationMs } : {}),
    ...(row.mimeType ? { mimeType: row.mimeType } : {}),
    ...(row.objectKey ? { objectKey: row.objectKey } : {}),
    revision: row.revision,
    ...(row.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
