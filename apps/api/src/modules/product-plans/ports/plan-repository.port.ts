import type {
  ProductPlan,
  ListPlansOptions,
  PaginatedResult,
} from "../domain/plan.types.js";

export const PLAN_REPOSITORY = Symbol("PLAN_REPOSITORY");

export interface PlanRepositoryPort {
  list(options: ListPlansOptions): Promise<PaginatedResult<ProductPlan>>;

  findById(id: string): Promise<ProductPlan | null>;

  save(plan: ProductPlan): Promise<ProductPlan>;

  nextContractVersion(planId: string): Promise<number>;
}
