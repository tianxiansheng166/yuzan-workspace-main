import type {
  Assignment,
  AssignmentSummary,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentStatus,
} from "../domain/assignment.types.js";

export const ASSIGNMENT_REPOSITORY = Symbol("ASSIGNMENT_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListAssignmentsOptions {
  readonly status?: AssignmentStatus;
  readonly studentUserId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AssignmentRepositoryPort {
  findById(
    schoolId: string,
    assignmentId: string,
  ): Promise<Assignment | null>;

  list(
    schoolId: string,
    options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>>;

  listByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly AssignmentSummary[]>;

  save(
    input: CreateAssignmentInput,
    createdByUserId: string,
  ): Promise<Assignment>;

  update(
    schoolId: string,
    assignmentId: string,
    data: UpdateAssignmentInput,
    expectedRevision: number,
  ): Promise<Assignment>;

  updateStatus(
    schoolId: string,
    assignmentId: string,
    status: AssignmentStatus,
    expectedRevision: number,
  ): Promise<Assignment>;

  softDelete(schoolId: string, assignmentId: string): Promise<void>;
}
