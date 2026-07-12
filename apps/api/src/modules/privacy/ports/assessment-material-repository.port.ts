import type {
  AssessmentMaterial,
  ListMaterialsOptions,
  PaginatedResult,
} from "../domain/assessment.types.js";

export const ASSESSMENT_MATERIAL_REPOSITORY = Symbol("ASSESSMENT_MATERIAL_REPOSITORY");

export interface AssessmentMaterialRepositoryPort {
  list(options: ListMaterialsOptions): Promise<PaginatedResult<AssessmentMaterial>>;
  findById(schoolId: string, id: string): Promise<AssessmentMaterial | null>;
  save(material: AssessmentMaterial): Promise<AssessmentMaterial>;
  nextVersion(schoolId: string, type: string): Promise<number>;
}
