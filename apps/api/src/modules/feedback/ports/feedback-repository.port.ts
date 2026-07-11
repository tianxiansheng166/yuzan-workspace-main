import type { Feedback, CreateFeedbackInput } from "../domain/feedback.types.js";

export const FEEDBACK_REPOSITORY = Symbol("FEEDBACK_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListPendingFeedbackOptions {
  readonly limit: number;
  readonly cursor?: string;
}

export interface FeedbackRepositoryPort {
  findById(
    schoolId: string,
    feedbackId: string,
  ): Promise<Feedback | null>;

  findBySubmissionId(
    schoolId: string,
    submissionId: string,
  ): Promise<readonly Feedback[]>;

  findPendingBySchool(
    schoolId: string,
    options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<Feedback>>;

  save(input: CreateFeedbackInput): Promise<Feedback>;
}
