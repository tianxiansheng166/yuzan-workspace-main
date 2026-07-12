import { Injectable } from "@nestjs/common";
import type { ProductPlan, ListPlansOptions, PaginatedResult } from "../domain/plan.types.js";
import { PlanNotFoundException } from "../domain/plan.errors.js";
import type { PlanRepositoryPort } from "./plan-repository.port.js";

@Injectable()
export class UnavailablePlanRepository implements PlanRepositoryPort {
  private fail(): never {
    throw new PlanNotFoundException("产品方案服务暂不可用");
  }

  async list(_options: ListPlansOptions): Promise<PaginatedResult<ProductPlan>> {
    this.fail();
  }

  async findById(_id: string): Promise<ProductPlan | null> {
    this.fail();
  }

  async save(_plan: ProductPlan): Promise<ProductPlan> {
    this.fail();
  }

  async nextContractVersion(_planId: string): Promise<number> {
    this.fail();
  }
}
