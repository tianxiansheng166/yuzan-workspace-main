import type {
  RecommendationRule,
  ListRulesOptions,
  PaginatedResult,
} from "../../../src/modules/product-plans/domain/rule.types.js";
import type { RuleRepositoryPort } from "../../../src/modules/product-plans/ports/rule-repository.port.js";

export class FakeRuleRepository implements RuleRepositoryPort {
  private readonly rules = new Map<string, RecommendationRule>();

  add(...rules: RecommendationRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
  }

  async list(
    options: ListRulesOptions,
  ): Promise<PaginatedResult<RecommendationRule>> {
    let all = Array.from(this.rules.values());

    if (options.status !== undefined) {
      all = all.filter((r) => r.status === options.status);
    }

    if (options.issueCode !== undefined) {
      all = all.filter((r) => r.issueCode === options.issueCode);
    }

    if (options.dimensionCode !== undefined) {
      all = all.filter((r) => r.dimensionCode === options.dimensionCode);
    }

    all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(id: string): Promise<RecommendationRule | null> {
    return this.rules.get(id) ?? null;
  }

  async save(rule: RecommendationRule): Promise<RecommendationRule> {
    this.rules.set(rule.id, rule);
    return rule;
  }

  async findConflictingRules(
    issueCode: string,
    dimensionCode: string,
    severityMin: number,
    severityMax: number,
    priority: number,
    excludeId?: string,
  ): Promise<readonly RecommendationRule[]> {
    return Array.from(this.rules.values()).filter((r) => {
      if (excludeId !== undefined && r.id === excludeId) {
        return false;
      }

      const sameIssueCode = r.issueCode === issueCode;
      const sameDimensionCode = r.dimensionCode === dimensionCode;
      const severityOverlaps =
        r.severityMin <= severityMax && severityMin <= r.severityMax;
      const samePriority = r.priority === priority;

      return sameIssueCode && sameDimensionCode && severityOverlaps && samePriority;
    });
  }
}
