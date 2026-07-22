export type FeedbackDecision = "ACCEPT" | "RETURN";

export interface Feedback {
  readonly id: string;
  readonly schoolId: string;
  readonly submissionId: string;
  readonly authorUserId: string;
  readonly decision: FeedbackDecision;
  readonly comment: string;
  readonly score?: number;
  readonly revision: number;
  readonly releasedAt: Date;
  readonly deletedAt?: Date;
}

export interface CreateFeedbackInput {
  readonly schoolId: string;
  readonly submissionId: string;
  readonly authorUserId: string;
  readonly decision: FeedbackDecision;
  readonly comment: string;
  readonly score?: number;
}
