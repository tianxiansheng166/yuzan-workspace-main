import type {
  ProductPlan,
  ListPlansOptions,
  PaginatedResult,
} from "../../../src/modules/product-plans/domain/plan.types.js";
import type { PlanRepositoryPort } from "../../../src/modules/product-plans/ports/plan-repository.port.js";

export class FakePlanRepository implements PlanRepositoryPort {
  private readonly plans = new Map<string, ProductPlan>();

  add(...plans: ProductPlan[]): void {
    for (const plan of plans) {
      this.plans.set(plan.id, plan);
    }
  }

  async list(options: ListPlansOptions): Promise<PaginatedResult<ProductPlan>> {
    let all = Array.from(this.plans.values());

    if (options.tier !== undefined) {
      all = all.filter((p) => p.tier === options.tier);
    }

    if (options.isActive !== undefined) {
      all = all.filter((p) => p.isActive === options.isActive);
    }

    all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(id: string): Promise<ProductPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async save(plan: ProductPlan): Promise<ProductPlan> {
    this.plans.set(plan.id, plan);
    return plan;
  }

  async nextContractVersion(_planId: string): Promise<number> {
    const maxVersion = Array.from(this.plans.values()).reduce(
      (max, p) => Math.max(max, p.contractVersion),
      0,
    );
    return maxVersion + 1;
  }
}
