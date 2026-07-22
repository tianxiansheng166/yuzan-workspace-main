export type SubmissionStatus =
  | "IN_PROGRESS"
  | "PENDING_SYNC"
  | "SUBMITTED"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "REVIEWED"
  | "RETURNED"
  | "ACCEPTED";

export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  "IN_PROGRESS",
  "PENDING_SYNC",
  "SUBMITTED",
  "PROCESSING",
  "NEEDS_REVIEW",
  "REVIEWED",
  "RETURNED",
  "ACCEPTED",
];

export interface Submission {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly status: SubmissionStatus;
  readonly idempotencyKey: string;
  readonly deviceId?: string;
  readonly revision: number;
  readonly submittedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export interface SubmissionSummary {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly attemptNo: number;
  readonly status: SubmissionStatus;
  readonly revision: number;
  readonly submittedAt?: Date;
  readonly createdAt: Date;
}

export interface CreateSubmissionInput {
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly enrollmentId: string;
  readonly idempotencyKey: string;
}
