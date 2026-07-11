import type {
  CourseVersion,
  CourseVersionStatus,
  CourseVersionSummary,
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
