import type {
  Assignment,
  AssignmentStatus,
  AssignmentSummary,
} from "../domain/assignment.types.js";

export const ASSIGNMENT_REPOSITORY = Symbol("ASSIGNMENT_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListAssignmentsOptions {
  readonly classId?: string;
  readonly status?: AssignmentStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface SaveAssignmentOptions {
  readonly generateId?: boolean;
}

export interface AssignmentRepositoryPort {
  findById(schoolId: string, assignmentId: string): Promise<Assignment | null>;
  list(
    schoolId: string,
    options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>>;
  save(
    assignment: Assignment,
    options?: SaveAssignmentOptions,
  ): Promise<Assignment>;
}
