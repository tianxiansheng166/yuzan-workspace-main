import type { CourseVersionStatus } from "../../curriculum/domain/course-version.types.js";
import type {
  GovernanceCourseVersion,
  GovernanceCourseVersionSummary,
  GovernanceVersionListResult,
  ListGovernanceVersionsOptions,
} from "../domain/governance.types.js";

export const GOVERNANCE_REPOSITORY = Symbol("GOVERNANCE_REPOSITORY");

export interface GovernanceRepositoryPort {
  listAll(
    options: ListGovernanceVersionsOptions,
  ): Promise<GovernanceVersionListResult>;

  findById(
    schoolId: string,
    id: string,
  ): Promise<GovernanceCourseVersion | null>;

  updateStatus(
    schoolId: string,
    id: string,
    status: CourseVersionStatus,
    timestampFields: Record<string, Date>,
    expectedUpdatedAt: Date,
  ): Promise<GovernanceCourseVersion>;

  findByIdPlatformWide(
    id: string,
  ): Promise<GovernanceCourseVersion | null>;
}
