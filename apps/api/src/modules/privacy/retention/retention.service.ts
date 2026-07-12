import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  RetentionPolicy,
  ListRetentionPoliciesOptions,
} from "../domain/privacy.types.js";
import {
  PrivacyForbiddenException,
  RetentionPolicyNotFoundException,
  RetentionPolicyConflictException,
} from "../domain/privacy.errors.js";
import { PrivacyPolicy } from "../domain/privacy.policy.js";
import { RETENTION_REPOSITORY } from "../ports/retention-repository.port.js";
import type { RetentionRepositoryPort } from "../ports/retention-repository.port.js";
import { toRetentionPolicyResponse } from "../dto/retention-policy.response.js";
import type { CreateRetentionDto } from "../dto/create-retention.dto.js";
import type { UpdateRetentionDto } from "../dto/update-retention.dto.js";

@Injectable()
export class RetentionService {
  private readonly policy = new PrivacyPolicy();

  constructor(
    @Inject(RETENTION_REPOSITORY)
    private readonly retentionRepo: RetentionRepositoryPort,
  ) {}

  async list(auth: AuthContext, options: ListRetentionPoliciesOptions) {
    if (!this.policy.canManageRetention(auth)) {
      throw new PrivacyForbiddenException();
    }

    const result = await this.retentionRepo.list(options);
    return {
      items: result.items.map(toRetentionPolicyResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async create(auth: AuthContext, dto: CreateRetentionDto) {
    if (!this.policy.canManageRetention(auth)) {
      throw new PrivacyForbiddenException();
    }

    const existing = await this.retentionRepo.findByResourceType(dto.resourceType);
    if (existing) {
      throw new RetentionPolicyConflictException(
        `资源类型 "${dto.resourceType}" 已存在保留策略`,
      );
    }

    const now = new Date();
    const policy: RetentionPolicy = {
      id: randomUUID(),
      resourceType: dto.resourceType,
      retentionDays: dto.retentionDays,
      description: dto.description ?? null,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : now,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.retentionRepo.save(policy);
    return toRetentionPolicyResponse(saved);
  }

  async update(auth: AuthContext, id: string, dto: UpdateRetentionDto) {
    if (!this.policy.canManageRetention(auth)) {
      throw new PrivacyForbiddenException();
    }

    const existing = await this.retentionRepo.findById(id);
    if (!existing) {
      throw new RetentionPolicyNotFoundException();
    }

    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt).getTime();
    if (existing.updatedAt.getTime() !== expectedUpdatedAt) {
      throw new RetentionPolicyConflictException(
        "保留策略已被修改，请刷新后重试",
      );
    }

    const updates: {
      retentionDays?: number;
      description?: string | null;
    } = {};
    if (dto.retentionDays !== undefined) {
      updates.retentionDays = dto.retentionDays;
    }
    if (dto.description !== undefined) {
      updates.description = dto.description;
    }

    const saved = await this.retentionRepo.update(id, updates, existing.updatedAt);
    return toRetentionPolicyResponse(saved);
  }
}
