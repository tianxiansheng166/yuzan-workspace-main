import type { School, SchoolSummary } from "../domain/organization.types.js";

export const SCHOOL_REPOSITORY = Symbol("SCHOOL_REPOSITORY");

export interface SchoolRepositoryPort {
  findById(schoolId: string): Promise<School | null>;
  listActive(): Promise<readonly SchoolSummary[]>;
}
