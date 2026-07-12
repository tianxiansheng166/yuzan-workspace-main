import type { CourseVersionStatus } from "../../curriculum/domain/course-version.types.js";
import type {
  GovernanceCourseVersion,
  GovernanceCourseVersionSummary,
} from "../domain/governance.types.js";

/* ---------- Summary response ---------- */

export interface GovernanceVersionSummaryResponse {
  readonly id: string;
  readonly courseId: string;
  readonly version: number;
  readonly title: string;
  readonly status: CourseVersionStatus;
  readonly gradeBand: string | null;
  readonly schoolId: string;
  readonly updatedAt: string;
}

export function toGovernanceVersionSummaryResponse(
  version: GovernanceCourseVersionSummary,
): GovernanceVersionSummaryResponse {
  return {
    id: version.id,
    courseId: version.courseId,
    version: version.version,
    title: version.title,
    status: version.status,
    gradeBand: version.gradeBand,
    schoolId: version.schoolId,
    updatedAt: version.updatedAt.toISOString(),
  };
}

/* ---------- Detail response ---------- */

export interface GovernanceVersionResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly courseId: string;
  readonly version: number;
  readonly status: CourseVersionStatus;
  readonly title: string;
  readonly description: string | null;
  readonly gradeBand: string | null;
  readonly locale: string;
  readonly objectives: readonly unknown[];
  readonly submittedAt: string | null;
  readonly approvedAt: string | null;
  readonly publishedAt: string | null;
  readonly retiredAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toGovernanceVersionResponse(
  version: GovernanceCourseVersion,
): GovernanceVersionResponse {
  return {
    id: version.id,
    schoolId: version.schoolId,
    courseId: version.courseId,
    version: version.version,
    status: version.status,
    title: version.title,
    description: version.description,
    gradeBand: version.gradeBand,
    locale: version.locale,
    objectives: version.objectives,
    submittedAt: version.submittedAt?.toISOString() ?? null,
    approvedAt: version.approvedAt?.toISOString() ?? null,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    retiredAt: version.retiredAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}
