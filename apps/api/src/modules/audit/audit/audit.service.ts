import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type { AuditSearchParams } from "../domain/audit.types.js";
import { AuditForbiddenException } from "../domain/audit.errors.js";
import { AuditPolicy } from "../domain/audit.policy.js";
import { AUDIT_REPOSITORY } from "../ports/audit-repository.port.js";
import type { AuditRepositoryPort } from "../ports/audit-repository.port.js";
import {
  toAuditLogResponse,
  type AuditLogResponse,
} from "../dto/audit-log.response.js";

@Injectable()
export class AuditService {
  private readonly policy = new AuditPolicy();

  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepo: AuditRepositoryPort,
  ) {}

  async search(
    auth: AuthContext,
    params: AuditSearchParams,
  ): Promise<{
    items: readonly AuditLogResponse[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!this.policy.canSearchAudit(auth)) {
      throw new AuditForbiddenException();
    }

    const result = await this.auditRepo.search(params);
    return {
      items: result.items.map(toAuditLogResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async findById(auth: AuthContext, id: string): Promise<AuditLogResponse> {
    if (!this.policy.canViewAuditLogs(auth)) {
      throw new AuditForbiddenException();
    }

    const entry = await this.auditRepo.findById(null, id);
    if (!entry) {
      throw new AuditForbiddenException();
    }

    return toAuditLogResponse(entry);
  }

  async searchAuditLogs(
    auth: AuthContext,
    params: AuditSearchParams,
  ): Promise<{
    items: readonly AuditLogResponse[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    return this.search(auth, params);
  }
}
