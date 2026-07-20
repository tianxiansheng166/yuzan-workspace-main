import type {
  Assignment,
  AssignmentSummary,
  AssignmentTarget,
} from "../domain/assignment.types.js";

export interface AssignmentTargetResponse {
  readonly id: string;
  readonly targetType: "CLASS" | "STUDENT";
  readonly classId?: string;
  readonly enrollmentId?: string;
}

export function toAssignmentTargetResponse(
  target: AssignmentTarget,
): AssignmentTargetResponse {
  return {
    id: target.id,
    targetType: target.targetType,
    ...(target.classId ? { classId: target.classId } : {}),
    ...(target.enrollmentId ? { enrollmentId: target.enrollmentId } : {}),
  };
}

export interface AssignmentSummaryResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly status: string;
  readonly startsAt: string;
  readonly dueAt: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly targets: readonly AssignmentTargetResponse[];
}

export function toAssignmentSummaryResponse(
  assignment: AssignmentSummary,
): AssignmentSummaryResponse {
  return {
    id: assignment.id,
    schoolId: assignment.schoolId,
    title: assignment.title,
    status: assignment.status,
    startsAt: assignment.startsAt.toISOString(),
    dueAt: assignment.dueAt.toISOString(),
    revision: assignment.revision,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    targets: assignment.targets.map(toAssignmentTargetResponse),
  };
}

export interface AssignmentResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly courseVersionId: string;
  readonly createdByUserId: string;
  readonly title: string;
  readonly status: string;
  readonly startsAt: string;
  readonly dueAt: string;
  readonly offlineRequired: boolean;
  readonly completionRule?: unknown;
  readonly revision: number;
  readonly openedAt?: string;
  readonly closedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly targets: readonly AssignmentTargetResponse[];
}

export function toAssignmentResponse(
  assignment: Assignment,
): AssignmentResponse {
  return {
    id: assignment.id,
    schoolId: assignment.schoolId,
    courseVersionId: assignment.courseVersionId,
    createdByUserId: assignment.createdByUserId,
    title: assignment.title,
    status: assignment.status,
    startsAt: assignment.startsAt.toISOString(),
    dueAt: assignment.dueAt.toISOString(),
    offlineRequired: assignment.offlineRequired,
    ...(assignment.completionRule !== undefined ? { completionRule: assignment.completionRule } : {}),
    revision: assignment.revision,
    ...(assignment.openedAt ? { openedAt: assignment.openedAt.toISOString() } : {}),
    ...(assignment.closedAt ? { closedAt: assignment.closedAt.toISOString() } : {}),
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    targets: assignment.targets.map(toAssignmentTargetResponse),
  };
}
