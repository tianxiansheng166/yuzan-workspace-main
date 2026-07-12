import type {
  RetentionPolicy,
  ListRetentionPoliciesOptions,
  PaginatedResult,
} from "../../../src/modules/privacy/domain/privacy.types.js";
import type { RetentionRepositoryPort } from "../../../src/modules/privacy/ports/retention-repository.port.js";

export class FakeRetentionRepository implements RetentionRepositoryPort {
  private readonly policies = new Map<string, RetentionPolicy>();

  add(...policies: RetentionPolicy[]): void {
    for (const policy of policies) {
      this.policies.set(policy.id, policy);
    }
  }

  async list(
    options: ListRetentionPoliciesOptions,
  ): Promise<PaginatedResult<RetentionPolicy>> {
    const all = Array.from(this.policies.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(id: string): Promise<RetentionPolicy | null> {
    return this.policies.get(id) ?? null;
  }

  async findByResourceType(resourceType: string): Promise<RetentionPolicy | null> {
    for (const policy of this.policies.values()) {
      if (policy.resourceType === resourceType) {
        return policy;
      }
    }
    return null;
  }

  async save(policy: RetentionPolicy): Promise<RetentionPolicy> {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async update(
    id: string,
    updates: Partial<Pick<RetentionPolicy, "retentionDays" | "description">>,
    expectedUpdatedAt: Date,
  ): Promise<RetentionPolicy> {
    const existing = this.policies.get(id);
    if (!existing) {
      throw new Error(`RetentionPolicy ${id} not found`);
    }

    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new Error("Optimistic concurrency check failed");
    }

    const updated: RetentionPolicy = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.policies.set(id, updated);
    return updated;
  }
}
