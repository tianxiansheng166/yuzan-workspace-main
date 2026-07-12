import type { RetentionPolicy } from "../domain/privacy.types.js";

export interface RetentionPolicyResponse {
  readonly id: string;
  readonly resourceType: string;
  readonly retentionDays: number;
  readonly description: string | null;
  readonly effectiveFrom: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toRetentionPolicyResponse(
  policy: RetentionPolicy,
): RetentionPolicyResponse {
  return {
    id: policy.id,
    resourceType: policy.resourceType,
    retentionDays: policy.retentionDays,
    description: policy.description,
    effectiveFrom: policy.effectiveFrom.toISOString(),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}
