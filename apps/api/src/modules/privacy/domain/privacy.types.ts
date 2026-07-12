export interface RetentionPolicy {
  readonly id: string;
  readonly resourceType: string;
  readonly retentionDays: number;
  readonly description: string | null;
  readonly effectiveFrom: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ConsentVersion {
  readonly id: string;
  readonly purpose: string;
  readonly version: number;
  readonly contentHash: string;
  readonly contentUrl: string | null;
  readonly effectiveFrom: Date;
  readonly createdAt: Date;
}

export type DeletionRequestStatus = "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED";

export interface DataDeletionRequest {
  readonly id: string;
  readonly userId: string;
  readonly schoolId: string | null;
  readonly status: DeletionRequestStatus;
  readonly requestedAt: Date;
  readonly approvedAt: Date | null;
  readonly completedAt: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListRetentionPoliciesOptions {
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListConsentVersionsOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly purpose?: string;
}

export interface ListDeletionRequestsOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: DeletionRequestStatus;
  readonly userId?: string;
  readonly schoolId?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
