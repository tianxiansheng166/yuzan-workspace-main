import { randomUUID } from "node:crypto";
import type { AuditLogEntry } from "../../../src/modules/audit/domain/audit.types.js";

export function auditLogEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: randomUUID(),
    schoolId: "school-a",
    actorUserId: "user-1",
    action: "CREATE",
    resourceType: "COURSE_VERSION",
    resourceId: "resource-1",
    requestId: "req-1",
    beforeSummary: null,
    afterSummary: null,
    createdAt: new Date("2025-01-15T10:00:00Z"),
    ...overrides,
  };
}
