import { Injectable } from "@nestjs/common";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";
import type { AssignmentSummary } from "../domain/assignment.types.js";
import type { AssignmentLookupPort } from "./assignment-lookup.port.js";

@Injectable()
export class UnavailableAssignmentLookupAdapter implements AssignmentLookupPort {
  findSummaryById(
    _schoolId: string,
    _assignmentId: string,
  ): Promise<AssignmentSummary | null> {
    void _schoolId;
    void _assignmentId;
    return Promise.reject(new AssignmentUnavailableException());
  }

  isOpen(_schoolId: string, _assignmentId: string): Promise<boolean> {
    void _schoolId;
    void _assignmentId;
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
}
