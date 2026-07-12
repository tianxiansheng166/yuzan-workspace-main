import type { RuleConflict } from "../domain/rule.types.js";

export interface RuleConflictResponse {
  readonly ruleIdA: string;
  readonly ruleIdB: string;
  readonly conflictType: string;
  readonly description: string;
}

export function toRuleConflictResponse(
  conflict: RuleConflict,
): RuleConflictResponse {
  return {
    ruleIdA: conflict.ruleIdA,
    ruleIdB: conflict.ruleIdB,
    conflictType: conflict.conflictType,
    description: conflict.description,
  };
}
