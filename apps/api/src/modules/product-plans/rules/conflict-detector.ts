import type { RecommendationRule, RuleConflict } from "../domain/rule.types.js";

/**
 * Detect conflicts among recommendation rules.
 *
 * Two rules conflict when they share the same issueCode + dimensionCode
 * and have overlapping severity ranges with the same priority.
 */
export function detectConflicts(
  rules: readonly RecommendationRule[],
): RuleConflict[] {
  const conflicts: RuleConflict[] = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!;
      const b = rules[j]!;

      // Only check rules in the same issueCode + dimensionCode space
      if (a.issueCode !== b.issueCode || a.dimensionCode !== b.dimensionCode) {
        continue;
      }

      const severityOverlaps =
        a.severityMin <= b.severityMax && b.severityMin <= a.severityMax;
      const samePriority = a.priority === b.priority;

      if (severityOverlaps && samePriority) {
        // Full overlap: same severity range AND same priority
        const sameSeverityRange =
          a.severityMin === b.severityMin && a.severityMax === b.severityMax;

        const conflictType = sameSeverityRange
          ? "FULL_OVERLAP"
          : samePriority
            ? "PRIORITY_OVERLAP"
            : "SEVERITY_RANGE_OVERLAP";

        conflicts.push({
          ruleIdA: a.id,
          ruleIdB: b.id,
          conflictType,
          description: buildConflictDescription(a, b, conflictType),
        });
      }
    }
  }

  return conflicts;
}

function buildConflictDescription(
  a: RecommendationRule,
  b: RecommendationRule,
  conflictType: RuleConflict["conflictType"],
): string {
  const prefix = `规则 ${a.id} 与规则 ${b.id} 在问题码 ${a.issueCode}/${a.dimensionCode} 下`;
  switch (conflictType) {
    case "FULL_OVERLAP":
      return (
        prefix +
        `严重程度范围完全重叠 (${a.severityMin}-${a.severityMax}) 且优先级相同 (${a.priority})`
      );
    case "PRIORITY_OVERLAP":
      return (
        prefix +
        `严重程度范围重叠 (${a.severityMin}-${a.severityMax} vs ${b.severityMin}-${b.severityMax}) 且优先级相同 (${a.priority})`
      );
    case "SEVERITY_RANGE_OVERLAP":
      return (
        prefix +
        `严重程度范围重叠 (${a.severityMin}-${a.severityMax} vs ${b.severityMin}-${b.severityMax})`
      );
  }
}
