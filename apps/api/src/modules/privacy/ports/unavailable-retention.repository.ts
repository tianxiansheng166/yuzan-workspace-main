import { RetentionPolicyNotFoundException } from "../domain/privacy.errors.js";
import type { RetentionRepositoryPort } from "./retention-repository.port.js";

export class UnavailableRetentionRepository implements RetentionRepositoryPort {
  async list(): Promise<never> {
    throw new RetentionPolicyNotFoundException("保留策略仓库不可用");
  }
  async findById(): Promise<never> {
    throw new RetentionPolicyNotFoundException("保留策略仓库不可用");
  }
  async findByResourceType(): Promise<never> {
    throw new RetentionPolicyNotFoundException("保留策略仓库不可用");
  }
  async save(): Promise<never> {
    throw new RetentionPolicyNotFoundException("保留策略仓库不可用");
  }
  async update(): Promise<never> {
    throw new RetentionPolicyNotFoundException("保留策略仓库不可用");
  }
}
