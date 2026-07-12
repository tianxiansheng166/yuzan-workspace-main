import type { CourseVersionStatus } from "../../curriculum/domain/course-version.types.js";

export type ReviewDecisionType = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export const REVIEW_DECISION_TYPES: readonly ReviewDecisionType[] = [
  "APPROVE",
  "REQUEST_CHANGES",
  "REJECT",
];

export interface GovernanceCourseVersion {
  readonly id: string;
  readonly schoolId: string;
  readonly courseId: string;
  readonly version: number;
  readonly status: CourseVersionStatus;
  readonly title: string;
  readonly description: string | null;
  readonly gradeBand: string | null;
  readonly locale: string;
  readonly objectives: readonly unknown[];
  readonly submittedAt: Date | null;
  readonly approvedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GovernanceCourseVersionSummary {
  readonly id: string;
  readonly courseId: string;
  readonly version: number;
  readonly title: string;
  readonly status: CourseVersionStatus;
  readonly gradeBand: string | null;
  readonly schoolId: string;
  readonly updatedAt: Date;
}

export interface ReviewDecision {
  readonly id: string;
  readonly courseVersionId: string;
  readonly reviewerUserId: string;
  readonly decision: ReviewDecisionType;
  readonly comment: string | null;
  readonly createdAt: Date;
}

export interface ReviewHistory {
  readonly items: readonly ReviewDecision[];
}

export interface ListGovernanceVersionsOptions {
  readonly status?: CourseVersionStatus;
  readonly schoolId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface GovernanceVersionListResult {
  readonly items: readonly GovernanceCourseVersionSummary[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
