import type {
  RecommendationRule,
  ListRulesOptions,
  PaginatedResult,
} from "../domain/rule.types.js";

export const RULE_REPOSITORY = Symbol("RULE_REPOSITORY");

export interface RuleRepositoryPort {
  list(options: ListRulesOptions): Promise<PaginatedResult<RecommendationRule>>;

  findById(id: string): Promise<RecommendationRule | null>;

  save(rule: RecommendationRule): Promise<RecommendationRule>;

  findConflictingRules(
    issueCode: string,
    dimensionCode: string,
    severityMin: number,
    severityMax: number,
    priority: number,
    excludeId?: string,
  ): Promise<readonly RecommendationRule[]>;
}
