export type RecommendationRuleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const RECOMMENDATION_RULE_STATUSES: readonly RecommendationRuleStatus[] =
  ["DRAFT", "PUBLISHED", "ARCHIVED"];

export interface RecommendationRule {
  readonly id: string;
  readonly issueCode: string;
  readonly dimensionCode: string;
  readonly severityMin: number;
  readonly severityMax: number;
  readonly courseVersionId: string;
  readonly priority: number;
  readonly sessions: number;
  readonly reasonTemplate: string | null;
  readonly validFrom: Date | null;
  readonly validUntil: Date | null;
  readonly version: number;
  readonly status: RecommendationRuleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RuleConflict {
  readonly ruleIdA: string;
  readonly ruleIdB: string;
  readonly conflictType:
    | "PRIORITY_OVERLAP"
    | "SEVERITY_RANGE_OVERLAP"
    | "FULL_OVERLAP";
  readonly description: string;
}

export interface ListRulesOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: RecommendationRuleStatus;
  readonly issueCode?: string;
  readonly dimensionCode?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
