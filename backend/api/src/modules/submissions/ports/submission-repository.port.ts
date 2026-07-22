import type {
  CreateSubmissionInput,
  Submission,
  SubmissionStatus,
  SubmissionSummary,
} from "../domain/submission.types.js";

export const SUBMISSION_REPOSITORY = Symbol("SUBMISSION_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListSubmissionsOptions {
  readonly status?: SubmissionStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface SubmissionRepositoryPort {
  findById(
    schoolId: string,
    submissionId: string,
  ): Promise<Submission | null>;

  findByEnrollmentAndIdempotencyKey(
    enrollmentId: string,
    idempotencyKey: string,
  ): Promise<Submission | null>;

  listByAssignment(
    schoolId: string,
    assignmentId: string,
    options: ListSubmissionsOptions,
  ): Promise<PaginatedResult<SubmissionSummary>>;

  listByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly SubmissionSummary[]>;

  save(input: CreateSubmissionInput): Promise<Submission>;

  updateStatus(
    schoolId: string,
    submissionId: string,
    status: SubmissionStatus,
    expectedRevision: number,
  ): Promise<Submission>;

  getNextAttemptNo(
    assignmentId: string,
    enrollmentId: string,
  ): Promise<number>;
}
