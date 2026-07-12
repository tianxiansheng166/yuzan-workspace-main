import type {
  AssessmentLink,
  ListLinksOptions,
  PaginatedResult,
} from "../domain/link.types.js";

export const LINK_REPOSITORY = Symbol("LINK_REPOSITORY");

export interface LinkRepositoryPort {
  list(options: ListLinksOptions): Promise<PaginatedResult<AssessmentLink>>;

  findById(schoolId: string, id: string): Promise<AssessmentLink | null>;

  save(link: AssessmentLink): Promise<AssessmentLink>;

  incrementUsageCount(schoolId: string, id: string): Promise<void>;
}
