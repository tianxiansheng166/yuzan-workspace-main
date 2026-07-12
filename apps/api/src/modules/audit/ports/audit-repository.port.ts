import type {
  AuditLogEntry,
  AuditSearchParams,
  AuditSearchResult,
} from "../domain/audit.types.js";

export const AUDIT_REPOSITORY = Symbol("AUDIT_REPOSITORY");

export interface AuditRepositoryPort {
  search(params: AuditSearchParams): Promise<AuditSearchResult>;
  findById(schoolId: string | null, id: string): Promise<AuditLogEntry | null>;
}
