export type AssessmentLinkStatus = "ACTIVE" | "DISABLED" | "EXPIRED";

export const ASSESSMENT_LINK_STATUSES: readonly AssessmentLinkStatus[] = [
  "ACTIVE",
  "DISABLED",
  "EXPIRED",
];

export interface AssessmentLink {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly tokenHash: string;
  readonly status: AssessmentLinkStatus;
  readonly usageCount: number;
  readonly expiresAt: Date | null;
  readonly disabledAt: Date | null;
  readonly regeneratedFromId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListLinksOptions {
  readonly schoolId: string;
  readonly assignmentId?: string;
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: AssessmentLinkStatus;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
