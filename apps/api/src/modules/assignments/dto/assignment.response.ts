import type {
  ActivityRef,
  Assignment,
  AssignmentSummary,
  LatePolicy,
  RetryPolicy,
} from "../domain/assignment.types.js";

export interface AssignmentResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly classId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly teacherNotes: string | null;
  readonly studentNotes: string | null;
  readonly activityRefs: readonly ActivityRef[];
  readonly status: Assignment["status"];
  readonly publishAt: Date | null;
  readonly dueAt: Date | null;
  readonly latePolicy: LatePolicy;
  readonly retryPolicy: RetryPolicy;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
  readonly closedAt: Date | null;
}

export interface AssignmentSummaryResponse {
  readonly id: string;
  readonly classId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly status: Assignment["status"];
  readonly publishAt: Date | null;
  readonly dueAt: Date | null;
  readonly updatedAt: Date;
}

export function toAssignmentResponse(
  assignment: Assignment,
): AssignmentResponse {
  return {
    id: assignment.id,
    schoolId: assignment.schoolId,
    classId: assignment.classId,
    courseVersionId: assignment.courseVersionId,
    title: assignment.title,
    teacherNotes: assignment.teacherNotes ?? null,
    studentNotes: assignment.studentNotes ?? null,
    activityRefs: assignment.activityRefs,
    status: assignment.status,
    publishAt: assignment.publishAt ?? null,
    dueAt: assignment.dueAt ?? null,
    latePolicy: assignment.latePolicy,
    retryPolicy: assignment.retryPolicy,
    createdByUserId: assignment.createdByUserId,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    publishedAt: assignment.publishedAt ?? null,
    closedAt: assignment.closedAt ?? null,
  };
}

export function toAssignmentSummaryResponse(
  summary: AssignmentSummary,
): AssignmentSummaryResponse {
  return {
    id: summary.id,
    classId: summary.classId,
    courseVersionId: summary.courseVersionId,
    title: summary.title,
    status: summary.status,
    publishAt: summary.publishAt,
    dueAt: summary.dueAt,
    updatedAt: summary.updatedAt,
  };
}
