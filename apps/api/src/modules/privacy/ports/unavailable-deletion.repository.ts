import { DeletionRequestNotFoundException } from "../domain/privacy.errors.js";
import type { DeletionRequestRepositoryPort } from "./deletion-repository.port.js";

export class UnavailableDeletionRepository implements DeletionRequestRepositoryPort {
  async list(): Promise<never> {
    throw new DeletionRequestNotFoundException("删除请求仓库不可用");
  }
  async findById(): Promise<never> {
    throw new DeletionRequestNotFoundException("删除请求仓库不可用");
  }
  async save(): Promise<never> {
    throw new DeletionRequestNotFoundException("删除请求仓库不可用");
  }
}
