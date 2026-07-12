import type { AuditLogEntry } from "../domain/audit.types.js";

export interface AuditLogResponse {
  readonly id: string;
  readonly schoolId: string | null;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly requestId: string;
  readonly beforeSummary: unknown | null;
  readonly afterSummary: unknown | null;
  readonly createdAt: string;
}

export function toAuditLogResponse(entry: AuditLogEntry): AuditLogResponse {
  return {
    id: entry.id,
    schoolId: entry.schoolId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    requestId: entry.requestId,
    beforeSummary: entry.beforeSummary,
    afterSummary: entry.afterSummary,
    createdAt: entry.createdAt.toISOString(),
  };
}
