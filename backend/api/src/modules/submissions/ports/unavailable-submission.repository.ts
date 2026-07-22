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
  async findById(
    _schoolId: string,
    _submissionId: string,
  ): Promise<Submission | null> {
    throw new SubmissionUnavailableException();
  }

  async findByEnrollmentAndIdempotencyKey(
    _enrollmentId: string,
    _idempotencyKey: string,
  ): Promise<Submission | null> {
    throw new SubmissionUnavailableException();
  }

  async listByAssignment(
    _schoolId: string,
    _assignmentId: string,
    _options: ListSubmissionsOptions,
  ): Promise<PaginatedResult<SubmissionSummary>> {
    throw new SubmissionUnavailableException();
  }

  async listByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly SubmissionSummary[]> {
    throw new SubmissionUnavailableException();
  }

  async save(_input: CreateSubmissionInput): Promise<Submission> {
    throw new SubmissionUnavailableException();
  }

  async updateStatus(
    _schoolId: string,
    _submissionId: string,
    _status: SubmissionStatus,
    _expectedRevision: number,
  ): Promise<Submission> {
    throw new SubmissionUnavailableException();
  }

  async getNextAttemptNo(
    _assignmentId: string,
    _enrollmentId: string,
  ): Promise<number> {
    throw new SubmissionUnavailableException();
  }

  // SubmissionLookupPort implementation
  async findSummaryById(
    _schoolId: string,
    _submissionId: string,
  ): Promise<SubmissionSummary | null> {
    throw new SubmissionUnavailableException();
  }

  async transitionStatus(
    _schoolId: string,
    _submissionId: string,
    _to: SubmissionStatus,
    _expectedRevision: number,
  ): Promise<SubmissionSummary> {
    throw new SubmissionUnavailableException();
  }
}
