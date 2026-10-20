import { Injectable } from "@nestjs/common";
import type {
  CreateSubmissionInput,
  Submission,
  SubmissionStatus,
  SubmissionSummary,
} from "../domain/submission.types.js";
import { SubmissionUnavailableException } from "../domain/submission.errors.js";
import type {
  ListSubmissionsOptions,
  PaginatedResult,
  SubmissionRepositoryPort,
} from "./submission-repository.port.js";
import type { SubmissionLookupPort } from "./submission-lookup.port.js";

@Injectable()
export class UnavailableSubmissionRepository
  implements SubmissionRepositoryPort, SubmissionLookupPort
{
  findById(
    _schoolId: string,
    _submissionId: string,
  ): Promise<Submission | null> {
    void _schoolId;
    void _submissionId;
    return Promise.reject(new SubmissionUnavailableException());
  }

  findByEnrollmentAndIdempotencyKey(
    _enrollmentId: string,
    _idempotencyKey: string,
  ): Promise<Submission | null> {
    void _enrollmentId;
    void _idempotencyKey;
    return Promise.reject(new SubmissionUnavailableException());
  }

  listByAssignment(
    _schoolId: string,
    _assignmentId: string,
    _options: ListSubmissionsOptions,
  ): Promise<PaginatedResult<SubmissionSummary>> {
    void _schoolId;
    void _assignmentId;
    void _options;
    return Promise.reject(new SubmissionUnavailableException());
  }

  listByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly SubmissionSummary[]> {
    void _schoolId;
    void _enrollmentId;
    return Promise.reject(new SubmissionUnavailableException());
  }

  save(_input: CreateSubmissionInput): Promise<Submission> {
    void _input;
    return Promise.reject(new SubmissionUnavailableException());
  }

  updateStatus(
    _schoolId: string,
    _submissionId: string,
    _status: SubmissionStatus,
    _expectedRevision: number,
  ): Promise<Submission> {
    void _schoolId;
    void _submissionId;
    void _status;
    void _expectedRevision;
    return Promise.reject(new SubmissionUnavailableException());
  }

  getNextAttemptNo(
    _assignmentId: string,
    _enrollmentId: string,
  ): Promise<number> {
    void _assignmentId;
    void _enrollmentId;
    return Promise.reject(new SubmissionUnavailableException());
  }

  // SubmissionLookupPort implementation
  findSummaryById(
    _schoolId: string,
    _submissionId: string,
  ): Promise<SubmissionSummary | null> {
    void _schoolId;
    void _submissionId;
    return Promise.reject(new SubmissionUnavailableException());
  }

  transitionStatus(
    _schoolId: string,
    _submissionId: string,
    _to: SubmissionStatus,
    _expectedRevision: number,
  ): Promise<SubmissionSummary> {
    void _schoolId;
    void _submissionId;
    void _to;
    void _expectedRevision;
    return Promise.reject(new SubmissionUnavailableException());
  }
}
