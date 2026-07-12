import { Injectable } from "@nestjs/common";
import type {
  AuditLogEntry,
  AuditSearchParams,
  AuditSearchResult,
} from "../domain/audit.types.js";
import { AuditUnavailableException } from "../domain/audit.errors.js";
import type { AuditRepositoryPort } from "./audit-repository.port.js";

@Injectable()
export class UnavailableAuditRepository implements AuditRepositoryPort {
  async search(_params: AuditSearchParams): Promise<AuditSearchResult> {
    throw new AuditUnavailableException();
  }

  async findById(
    _schoolId: string | null,
    _id: string,
  ): Promise<AuditLogEntry | null> {
    throw new AuditUnavailableException();
  }
}
