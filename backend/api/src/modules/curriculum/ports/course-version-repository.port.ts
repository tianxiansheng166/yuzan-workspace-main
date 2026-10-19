import type {
  CourseVersion,
  CourseVersionStatus,
  CourseVersionSummary,
  CourseActivityPracticeWriteResult,
  CoursePracticeOption,
} from "../domain/course-version.types.js";

export const COURSE_VERSION_REPOSITORY = Symbol("COURSE_VERSION_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListCourseVersionsOptions {
  readonly status?: CourseVersionStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface SaveCourseVersionOptions {
  readonly generateVersion: boolean;
  readonly expectedUpdatedAt?: Date;
  /** Keep the existing activity tree when a mutation only changes version metadata. */
  readonly replaceUnits?: boolean;
}

export interface SaveCourseActivityPracticeInput {
  readonly schoolId: string;
  readonly courseVersionId: string;
  readonly courseAuthorUserId: string;
  readonly activityId: string;
  readonly practiceDefinitionId: string;
  readonly required: boolean;
  readonly expectedUpdatedAt: Date;
}

export interface CourseVersionRepositoryPort {
  nextVersion(schoolId: string, courseId: string): Promise<number>;
  save(
    version: CourseVersion,
    options?: SaveCourseVersionOptions,
  ): Promise<CourseVersion>;
  findById(
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersion | null>;
  list(
    schoolId: string,
    options: ListCourseVersionsOptions,
  ): Promise<PaginatedResult<CourseVersionSummary>>;
  findPublishedByCourseId(
    schoolId: string,
    courseId: string,
  ): Promise<CourseVersion | null>;
  findDraftsByCourseId(
    schoolId: string,
    courseId: string,
  ): Promise<readonly CourseVersion[]>;
  listCoursePracticeOptions(schoolId: string): Promise<readonly CoursePracticeOption[]>;
  saveActivityPractice(
    input: SaveCourseActivityPracticeInput,
  ): Promise<CourseActivityPracticeWriteResult>;
  publish(
    schoolId: string,
    courseVersionId: string,
    publishedAt: Date,
  ): Promise<CourseVersion | null>;
  retire(
    schoolId: string,
    courseVersionId: string,
    retiredAt: Date,
  ): Promise<CourseVersion | null>;
}
