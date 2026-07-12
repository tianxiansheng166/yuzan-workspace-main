import { Injectable } from "@nestjs/common";
import type { ProductPlanVersion } from "../domain/plan.types.js";
import { PlanNotFoundException } from "../domain/plan.errors.js";
import type { PlanVersionRepositoryPort } from "./plan-version-repository.port.js";

@Injectable()
export class UnavailablePlanVersionRepository
  implements PlanVersionRepositoryPort
{
  private fail(): never {
    throw new PlanNotFoundException("产品方案版本服务暂不可用");
  }

  async findByPlanId(_planId: string): Promise<readonly ProductPlanVersion[]> {
    this.fail();
  }

  async save(_version: ProductPlanVersion): Promise<ProductPlanVersion> {
    this.fail();
  }
}
