import type { RecommendationRule } from "../domain/rule.types.js";

export interface RecommendationRuleResponse {
  readonly id: string;
  readonly issueCode: string;
  readonly dimensionCode: string;
  readonly severityMin: number;
  readonly severityMax: number;
  readonly courseVersionId: string;
  readonly priority: number;
  readonly sessions: number;
  readonly reasonTemplate: string | null;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
  readonly version: number;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toRecommendationRuleResponse(
  rule: RecommendationRule,
): RecommendationRuleResponse {
  return {
    id: rule.id,
    issueCode: rule.issueCode,
    dimensionCode: rule.dimensionCode,
    severityMin: rule.severityMin,
    severityMax: rule.severityMax,
    courseVersionId: rule.courseVersionId,
    priority: rule.priority,
    sessions: rule.sessions,
    reasonTemplate: rule.reasonTemplate,
    validFrom: rule.validFrom?.toISOString() ?? null,
    validUntil: rule.validUntil?.toISOString() ?? null,
    version: rule.version,
    status: rule.status,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}
