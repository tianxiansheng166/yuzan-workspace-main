export interface AuditLogEntry {
  readonly id: string;
  readonly schoolId: string | null;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly requestId: string;
  readonly beforeSummary: unknown | null;
  readonly afterSummary: unknown | null;
  readonly createdAt: Date;
}

export interface AuditSearchParams {
  readonly schoolId?: string;
  readonly actorUserId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AuditSearchResult {
  readonly items: readonly AuditLogEntry[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
