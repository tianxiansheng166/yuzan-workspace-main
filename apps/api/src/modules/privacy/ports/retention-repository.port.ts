import type {
  RetentionPolicy,
  ListRetentionPoliciesOptions,
  PaginatedResult,
} from "../domain/privacy.types.js";

export const RETENTION_REPOSITORY = Symbol("RETENTION_REPOSITORY");

export interface RetentionRepositoryPort {
  list(options: ListRetentionPoliciesOptions): Promise<PaginatedResult<RetentionPolicy>>;
  findById(id: string): Promise<RetentionPolicy | null>;
  findByResourceType(resourceType: string): Promise<RetentionPolicy | null>;
  save(policy: RetentionPolicy): Promise<RetentionPolicy>;
  update(
    id: string,
    updates: Partial<Pick<RetentionPolicy, "retentionDays" | "description">>,
    expectedUpdatedAt: Date,
  ): Promise<RetentionPolicy>;
}
