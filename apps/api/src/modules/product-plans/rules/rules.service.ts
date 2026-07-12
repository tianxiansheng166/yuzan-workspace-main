import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  RecommendationRule,
  ListRulesOptions,
  RuleConflict,
  PaginatedResult,
} from "../domain/rule.types.js";
import { RulePolicy } from "../domain/rule.policy.js";
import {
  RuleNotFoundException,
  RuleConflictException,
  RuleVersionConflictException,
} from "../domain/rule.errors.js";
import {
  RULE_REPOSITORY,
  type RuleRepositoryPort,
} from "../ports/rule-repository.port.js";
import { detectConflicts } from "./conflict-detector.js";
import type { CreateRuleDto } from "../dto/create-rule.dto.js";
import type { UpdateRuleDto } from "../dto/update-rule.dto.js";

@Injectable()
export class RulesService {
  private readonly policy = new RulePolicy();

  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepo: RuleRepositoryPort,
  ) {}

  async list(
    auth: AuthContext,
    options: ListRulesOptions,
  ): Promise<PaginatedResult<RecommendationRule>> {
    if (!this.policy.canViewRules(auth)) {
      throw new RuleConflictException("无权查看推荐规则");
    }

    return this.ruleRepo.list(options);
  }

  async findById(auth: AuthContext, id: string): Promise<RecommendationRule> {
    if (!this.policy.canViewRules(auth)) {
      throw new RuleConflictException("无权查看推荐规则");
    }

    const rule = await this.ruleRepo.findById(id);
    if (!rule) {
      throw new RuleNotFoundException();
    }
    return rule;
  }

  async create(auth: AuthContext, dto: CreateRuleDto): Promise<RecommendationRule> {
    if (!this.policy.canManageRules(auth)) {
      throw new RuleConflictException("无权创建推荐规则");
    }

    // Check for conflicts before saving
    const conflicts = await this.ruleRepo.findConflictingRules(
      dto.issueCode,
      dto.dimensionCode,
      dto.severityMin,
      dto.severityMax,
      dto.priority,
    );

    if (conflicts.length > 0) {
      throw new RuleConflictException(
        `与现有规则存在冲突: ${conflicts.map((r) => r.id).join(", ")}`,
      );
    }

    const now = new Date();

    const rule: RecommendationRule = {
      id: crypto.randomUUID(),
      issueCode: dto.issueCode,
      dimensionCode: dto.dimensionCode,
      severityMin: dto.severityMin,
      severityMax: dto.severityMax,
      courseVersionId: dto.courseVersionId,
      priority: dto.priority,
      sessions: dto.sessions ?? 1,
      reasonTemplate: dto.reasonTemplate ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      version: 1,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    };

    return this.ruleRepo.save(rule);
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: UpdateRuleDto,
  ): Promise<RecommendationRule> {
    if (!this.policy.canManageRules(auth)) {
      throw new RuleConflictException("无权更新推荐规则");
    }

    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new RuleNotFoundException();
    }

    const existingUpdatedAt = existing.updatedAt.getTime();
    if (existingUpdatedAt !== dto.expectedUpdatedAt) {
      throw new RuleVersionConflictException();
    }

    const updated: RecommendationRule = {
      ...existing,
      priority: dto.priority ?? existing.priority,
      sessions: dto.sessions ?? existing.sessions,
      reasonTemplate:
        dto.reasonTemplate !== undefined
          ? dto.reasonTemplate
          : existing.reasonTemplate,
      validFrom:
        dto.validFrom !== undefined
          ? dto.validFrom
            ? new Date(dto.validFrom)
            : null
          : existing.validFrom,
      validUntil:
        dto.validUntil !== undefined
          ? dto.validUntil
            ? new Date(dto.validUntil)
            : null
          : existing.validUntil,
      updatedAt: new Date(),
    };

    return this.ruleRepo.save(updated);
  }

  async publish(auth: AuthContext, id: string): Promise<RecommendationRule> {
    if (!this.policy.canManageRules(auth)) {
      throw new RuleConflictException("无权发布推荐规则");
    }

    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new RuleNotFoundException();
    }

    if (existing.status === "PUBLISHED") {
      throw new RuleConflictException("规则已发布，无需重复发布");
    }

    if (existing.status === "ARCHIVED") {
      throw new RuleConflictException("已归档规则不能发布");
    }

    // Check for conflicts before publishing
    const conflicts = await this.ruleRepo.findConflictingRules(
      existing.issueCode,
      existing.dimensionCode,
      existing.severityMin,
      existing.severityMax,
      existing.priority,
      existing.id,
    );

    if (conflicts.length > 0) {
      throw new RuleConflictException(
        `与已发布规则存在冲突: ${conflicts.map((r) => r.id).join(", ")}`,
      );
    }

    const now = new Date();
    const updated: RecommendationRule = {
      ...existing,
      status: "PUBLISHED",
      version: existing.version + 1,
      updatedAt: now,
    };

    return this.ruleRepo.save(updated);
  }

  async archive(auth: AuthContext, id: string): Promise<RecommendationRule> {
    if (!this.policy.canManageRules(auth)) {
      throw new RuleConflictException("无权归档推荐规则");
    }

    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new RuleNotFoundException();
    }

    if (existing.status === "ARCHIVED") {
      throw new RuleConflictException("规则已归档，无需重复归档");
    }

    const now = new Date();
    const updated: RecommendationRule = {
      ...existing,
      status: "ARCHIVED",
      updatedAt: now,
    };

    return this.ruleRepo.save(updated);
  }

  async detectConflictsForAll(
    auth: AuthContext,
  ): Promise<readonly RuleConflict[]> {
    if (!this.policy.canDetectConflicts(auth)) {
      throw new RuleConflictException("无权检测推荐规则冲突");
    }

    // Fetch all published and draft rules for conflict analysis
    const allRules: RecommendationRule[] = [];

    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const result = await this.ruleRepo.list({
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      allRules.push(...result.items);
      hasMore = result.hasMore;
      cursor = result.nextCursor ?? undefined;
    }

    return detectConflicts(allRules);
  }
}
