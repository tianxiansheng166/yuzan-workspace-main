import { Injectable } from "@nestjs/common";
import type {
  Assignment,
  AssignmentSummary,
} from "../domain/assignment.types.js";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
  PaginatedResult,
  SaveAssignmentOptions,
} from "./assignment-repository.port.js";

@Injectable()
export class UnavailableAssignmentRepository implements AssignmentRepositoryPort {
  findById(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<Assignment | null> {
    throw new AssignmentUnavailableException();
  }

  list(
    _schoolId: string,
    _options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>> {
    throw new AssignmentUnavailableException();
  }

  save(
    _assignment: Assignment,
    _options?: SaveAssignmentOptions,
  ): Promise<Assignment> {
    throw new AssignmentUnavailableException();
  }
}
