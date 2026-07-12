import { MaterialNotFoundException } from "../domain/assessment.errors.js";
import type { AssessmentMaterialRepositoryPort } from "./assessment-material-repository.port.js";

export class UnavailableAssessmentMaterialRepository implements AssessmentMaterialRepositoryPort {
  async list(): Promise<never> {
    throw new MaterialNotFoundException("测评材料仓库不可用");
  }
  async findById(): Promise<never> {
    throw new MaterialNotFoundException("测评材料仓库不可用");
  }
  async save(): Promise<never> {
    throw new MaterialNotFoundException("测评材料仓库不可用");
  }
  async nextVersion(): Promise<never> {
    throw new MaterialNotFoundException("测评材料仓库不可用");
  }
}
