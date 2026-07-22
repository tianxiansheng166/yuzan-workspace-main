import type { AssignmentSummary } from "../domain/assignment.types.js";

export const ASSIGNMENT_LOOKUP = Symbol("ASSIGNMENT_LOOKUP");

export interface AssignmentLookupPort {
  findSummaryById(
    schoolId: string,
    assignmentId: string,
  ): Promise<AssignmentSummary | null>;

  isOpen(schoolId: string, assignmentId: string): Promise<boolean>;

  listByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly AssignmentSummary[]>;
}
