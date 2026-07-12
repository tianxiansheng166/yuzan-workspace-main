import type { ProductPlanVersion } from "../domain/plan.types.js";

export const PLAN_VERSION_REPOSITORY = Symbol("PLAN_VERSION_REPOSITORY");

export interface PlanVersionRepositoryPort {
  findByPlanId(planId: string): Promise<readonly ProductPlanVersion[]>;

  save(version: ProductPlanVersion): Promise<ProductPlanVersion>;
}
