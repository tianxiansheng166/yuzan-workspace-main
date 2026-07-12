import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  DataDeletionRequest,
  DeletionRequestStatus,
  ListDeletionRequestsOptions,
} from "../domain/privacy.types.js";
import {
  PrivacyForbiddenException,
  DeletionRequestNotFoundException,
  DeletionConflictException,
} from "../domain/privacy.errors.js";
import { PrivacyPolicy } from "../domain/privacy.policy.js";
import { DELETION_REPOSITORY } from "../ports/deletion-repository.port.js";
import type { DeletionRequestRepositoryPort } from "../ports/deletion-repository.port.js";
import { toDeletionRequestResponse } from "../dto/deletion-request.response.js";
import type { ProcessDeletionDto } from "../dto/process-deletion.dto.js";

/**
 * Valid state transitions for deletion requests.
 * PENDING -> APPROVED | REJECTED
 * APPROVED -> PROCESSING
 * PROCESSING -> COMPLETED
 */
const VALID_TRANSITIONS: Record<DeletionRequestStatus, readonly DeletionRequestStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["PROCESSING"],
  PROCESSING: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
};

@Injectable()
export class DeletionService {
  private readonly policy = new PrivacyPolicy();

  constructor(
    @Inject(DELETION_REPOSITORY)
    private readonly deletionRepo: DeletionRequestRepositoryPort,
  ) {}

  async list(auth: AuthContext, options: ListDeletionRequestsOptions) {
    if (!this.policy.canViewDeletionRequests(auth)) {
      throw new PrivacyForbiddenException();
    }

    const result = await this.deletionRepo.list(options);
    return {
      items: result.items.map(toDeletionRequestResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async processDeletion(
    auth: AuthContext,
    id: string,
    dto: ProcessDeletionDto,
  ) {
    if (!this.policy.canProcessDeletion(auth)) {
      throw new PrivacyForbiddenException();
    }

    const request = await this.deletionRepo.findById(id);
    if (!request) {
      throw new DeletionRequestNotFoundException();
    }

    const newStatus = dto.status as DeletionRequestStatus;
    const allowed = VALID_TRANSITIONS[request.status];
    if (!allowed.includes(newStatus)) {
      throw new DeletionConflictException(
        `无法将删除请求从 "${request.status}" 转换为 "${newStatus}"`,
      );
    }

    const now = new Date();
    const updated: DataDeletionRequest = {
      ...request,
      status: newStatus,
      notes: dto.notes ?? request.notes,
      ...(newStatus === "APPROVED" ? { approvedAt: now } : {}),
      ...(newStatus === "COMPLETED" ? { completedAt: now } : {}),
      updatedAt: now,
    };

    const saved = await this.deletionRepo.save(updated);
    return toDeletionRequestResponse(saved);
  }
}
