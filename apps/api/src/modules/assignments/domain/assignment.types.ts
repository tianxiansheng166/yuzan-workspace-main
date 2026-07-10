export type AssignmentStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";

export const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "CLOSED",
  "ARCHIVED",
];

export type LatePolicy = "ACCEPT" | "REJECT" | "ACCEPT_WITH_PENALTY";

export const LATE_POLICIES: readonly LatePolicy[] = [
  "ACCEPT",
  "REJECT",
  "ACCEPT_WITH_PENALTY",
];

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly allowRetest: boolean;
}

export interface ActivityRef {
  readonly activityId: string;
  readonly activityType: string;
  readonly title: string;
}

export interface Assignment {
  readonly id: string;
  readonly schoolId: string;
  readonly classId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly teacherNotes?: string;
  readonly studentNotes?: string;
  readonly activityRefs: readonly ActivityRef[];
  readonly status: AssignmentStatus;
  readonly publishAt?: Date;
  readonly dueAt?: Date;
  readonly latePolicy: LatePolicy;
  readonly retryPolicy: RetryPolicy;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt?: Date;
  readonly closedAt?: Date;
}

export interface AssignmentSummary {
  readonly id: string;
  readonly classId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly status: AssignmentStatus;
  readonly publishAt: Date | null;
  readonly dueAt: Date | null;
  readonly updatedAt: Date;
}

export function toAssignmentSummary(assignment: Assignment): AssignmentSummary {
  return {
    id: assignment.id,
    classId: assignment.classId,
    courseVersionId: assignment.courseVersionId,
    title: assignment.title,
    status: assignment.status,
    publishAt: assignment.publishAt ?? null,
    dueAt: assignment.dueAt ?? null,
    updatedAt: assignment.updatedAt,
  };
}
