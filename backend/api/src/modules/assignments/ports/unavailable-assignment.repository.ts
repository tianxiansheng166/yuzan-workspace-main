import { Injectable } from "@nestjs/common";
import type {
  Assignment,
  AssignmentSummary,
  AssignmentStatus,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from "../domain/assignment.types.js";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
  PaginatedResult,
} from "./assignment-repository.port.js";

@Injectable()
export class UnavailableAssignmentRepository implements AssignmentRepositoryPort {
  findById(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<Assignment | null> {
    void _schoolId;
    void _assignmentId;
    return Promise.reject(new AssignmentUnavailableException());
  }

  list(
    _schoolId: string,
    _options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>> {
    void _schoolId;
    void _options;
    return Promise.reject(new AssignmentUnavailableException());
  }

  listByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly AssignmentSummary[]> {
    void _schoolId;
    void _enrollmentId;
    return Promise.reject(new AssignmentUnavailableException());
  }

  save(
    _input: CreateAssignmentInput,
    _createdByUserId: string,
  ): Promise<Assignment> {
    void _input;
    void _createdByUserId;
    return Promise.reject(new AssignmentUnavailableException());
  }

  update(
    _schoolId: string,
    _assignmentId: string,
    _data: UpdateAssignmentInput,
    _expectedRevision: number,
  ): Promise<Assignment> {
    void _schoolId;
    void _assignmentId;
    void _data;
    void _expectedRevision;
    return Promise.reject(new AssignmentUnavailableException());
  }

  updateStatus(
    _schoolId: string,
    _assignmentId: string,
    _status: AssignmentStatus,
    _expectedRevision: number,
  ): Promise<Assignment> {
    void _schoolId;
    void _assignmentId;
    void _status;
    void _expectedRevision;
    return Promise.reject(new AssignmentUnavailableException());
  }

  softDelete(_schoolId: string, _assignmentId: string): Promise<void> {
    void _schoolId;
    void _assignmentId;
    return Promise.reject(new AssignmentUnavailableException());
  }
}
