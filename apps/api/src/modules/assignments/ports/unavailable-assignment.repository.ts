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
  async findById(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<Assignment | null> {
    throw new AssignmentUnavailableException();
  }

  async list(
    _schoolId: string,
    _options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>> {
    throw new AssignmentUnavailableException();
  }

  async listByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly AssignmentSummary[]> {
    throw new AssignmentUnavailableException();
  }

  async save(
    _input: CreateAssignmentInput,
    _createdByUserId: string,
  ): Promise<Assignment> {
    throw new AssignmentUnavailableException();
  }

  async update(
    _schoolId: string,
    _assignmentId: string,
    _data: UpdateAssignmentInput,
    _expectedRevision: number,
  ): Promise<Assignment> {
    throw new AssignmentUnavailableException();
  }

  async updateStatus(
    _schoolId: string,
    _assignmentId: string,
    _status: AssignmentStatus,
    _expectedRevision: number,
  ): Promise<Assignment> {
    throw new AssignmentUnavailableException();
  }

  async softDelete(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<void> {
    throw new AssignmentUnavailableException();
  }
}
