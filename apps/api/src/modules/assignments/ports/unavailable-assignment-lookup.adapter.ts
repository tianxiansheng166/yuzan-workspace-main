import { Injectable } from "@nestjs/common";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";
import type { AssignmentSummary } from "../domain/assignment.types.js";
import type { AssignmentLookupPort } from "./assignment-lookup.port.js";

@Injectable()
export class UnavailableAssignmentLookupAdapter implements AssignmentLookupPort {
  async findSummaryById(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<AssignmentSummary | null> {
    throw new AssignmentUnavailableException();
  }

  async isOpen(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<boolean> {
    throw new AssignmentUnavailableException();
  }

  async listByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly AssignmentSummary[]> {
    throw new AssignmentUnavailableException();
  }
}
