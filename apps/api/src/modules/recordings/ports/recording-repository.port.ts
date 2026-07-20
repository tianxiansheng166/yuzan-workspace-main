import type {
  Recording,
  RecordingStatus,
  InitRecordingInput,
  CompleteRecordingInput,
} from "../domain/recording.types.js";

export const RECORDING_REPOSITORY = Symbol("RECORDING_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListRecordingsOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: RecordingStatus;
}

export interface RecordingRepositoryPort {
  findById(
    schoolId: string,
    recordingId: string,
  ): Promise<Recording | null>;

  findByIdempotencyKey(
    enrollmentId: string,
    idempotencyKey: string,
  ): Promise<Recording | null>;

  findBySubmissionId(
    schoolId: string,
    submissionId: string,
  ): Promise<readonly Recording[]>;

  listByEnrollment(
    schoolId: string,
    enrollmentId: string,
    options?: ListRecordingsOptions,
  ): Promise<PaginatedResult<Recording>>;

  save(input: InitRecordingInput): Promise<Recording>;

  updateStatus(
    schoolId: string,
    recordingId: string,
    status: RecordingStatus,
    expectedRevision: number,
  ): Promise<Recording>;

  updateUploadedParts(
    schoolId: string,
    recordingId: string,
    partNumber: number,
    expectedRevision: number,
  ): Promise<Recording>;

  completeRecording(
    schoolId: string,
    recordingId: string,
    input: CompleteRecordingInput,
    expectedRevision: number,
  ): Promise<Recording>;
}
