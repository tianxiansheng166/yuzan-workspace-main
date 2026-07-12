import type { ProductPlanVersion } from "../../../src/modules/product-plans/domain/plan.types.js";
import type { PlanVersionRepositoryPort } from "../../../src/modules/product-plans/ports/plan-version-repository.port.js";

export class FakePlanVersionRepository implements PlanVersionRepositoryPort {
  private readonly versions = new Map<string, ProductPlanVersion>();

  add(...versions: ProductPlanVersion[]): void {
    for (const version of versions) {
      this.versions.set(version.id, version);
    }
  }

  async findByPlanId(planId: string): Promise<readonly ProductPlanVersion[]> {
    return Array.from(this.versions.values()).filter(
      (v) => v.planId === planId,
    );
  }

  async save(version: ProductPlanVersion): Promise<ProductPlanVersion> {
    this.versions.set(version.id, version);
    return version;
  }
}
