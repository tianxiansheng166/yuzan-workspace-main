import type {
  Submission,
  SubmissionSummary,
} from "../domain/submission.types.js";

export interface SubmissionSummaryResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly status: string;
  readonly revision: number;
  readonly submittedAt?: string;
  readonly createdAt: string;
}

export function toSubmissionSummaryResponse(
  submission: SubmissionSummary,
): SubmissionSummaryResponse {
  return {
    id: submission.id,
    schoolId: submission.schoolId,
    assignmentId: submission.assignmentId,
    enrollmentId: submission.enrollmentId,
    attemptNo: submission.attemptNo,
    status: submission.status,
    revision: submission.revision,
    ...(submission.submittedAt
      ? { submittedAt: submission.submittedAt.toISOString() }
      : {}),
    createdAt: submission.createdAt.toISOString(),
  };
}

export interface SubmissionResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly status: string;
  readonly idempotencyKey: string;
  readonly deviceId?: string;
  readonly revision: number;
  readonly submittedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly writtenAnswer?: string;
  readonly recordingId?: string;
  readonly recordingUrl?: string;
  readonly recordingDuration?: number;
  readonly feedback?: {
    readonly id: string;
    readonly submissionId: string;
    readonly decision: string;
    readonly comment: string;
    readonly score?: number;
    readonly revision: number;
    readonly releasedAt: string;
  };
}

export function toSubmissionResponse(
  submission: Submission,
): SubmissionResponse {
  return {
    id: submission.id,
    schoolId: submission.schoolId,
    assignmentId: submission.assignmentId,
    enrollmentId: submission.enrollmentId,
    attemptNo: submission.attemptNo,
    status: submission.status,
    idempotencyKey: submission.idempotencyKey,
    ...(submission.deviceId ? { deviceId: submission.deviceId } : {}),
    revision: submission.revision,
    ...(submission.submittedAt
      ? { submittedAt: submission.submittedAt.toISOString() }
      : {}),
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}
