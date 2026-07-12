import { randomUUID } from "node:crypto";
import type {
  RecommendationRule,
  RecommendationRuleStatus,
} from "../../../src/modules/product-plans/domain/rule.types.js";

export function recommendationRule(
  overrides: Partial<RecommendationRule> = {},
): RecommendationRule {
  const now = new Date();
  return {
    id: randomUUID(),
    issueCode: "ANXIETY",
    dimensionCode: "EMOTIONAL",
    severityMin: 1,
    severityMax: 5,
    courseVersionId: randomUUID(),
    priority: 1,
    sessions: 4,
    reasonTemplate: null,
    validFrom: null,
    validUntil: null,
    version: 1,
    status: "DRAFT" as RecommendationRuleStatus,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
