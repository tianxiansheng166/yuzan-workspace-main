import type { SubmissionStatus, SubmissionSummary } from "../domain/submission.types.js";

export const SUBMISSION_LOOKUP = Symbol("SUBMISSION_LOOKUP");

export interface SubmissionLookupPort {
  findSummaryById(
    schoolId: string,
    submissionId: string,
  ): Promise<SubmissionSummary | null>;

  transitionStatus(
    schoolId: string,
    submissionId: string,
    to: SubmissionStatus,
    expectedRevision: number,
  ): Promise<SubmissionSummary>;
}
