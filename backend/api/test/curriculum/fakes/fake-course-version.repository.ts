import type {
  CourseVersion,
  CourseVersionSummary,
} from "../../../src/modules/curriculum/domain/course-version.types.js";
import { toSummary } from "../../../src/modules/curriculum/domain/course-version.types.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
  PaginatedResult,
  SaveCourseVersionOptions,
} from "../../../src/modules/curriculum/ports/course-version-repository.port.js";

export class FakeCourseVersionRepository implements CourseVersionRepositoryPort {
  private readonly versions = new Map<string, CourseVersion>();
  private readonly versionCounters = new Map<string, number>();

  add(...versions: CourseVersion[]): void {
    for (const version of versions) {
      this.versions.set(version.id, version);
      const current = this.versionCounters.get(version.courseId) ?? 0;
      if (version.version > current) {
        this.versionCounters.set(version.courseId, version.version);
      }
    }
  }

  async nextVersion(_schoolId: string, courseId: string): Promise<number> {
    const current = this.versionCounters.get(courseId) ?? 0;
    const next = current + 1;
    this.versionCounters.set(courseId, next);
    return next;
  }

  async save(
    version: CourseVersion,
    options?: SaveCourseVersionOptions,
  ): Promise<CourseVersion> {
    const generateVersion = options?.generateVersion ?? false;
    const versionNumber = generateVersion
      ? await this.nextVersion(version.schoolId, version.courseId)
      : version.version;

    const saved: CourseVersion = {
      ...version,
      version: versionNumber,
      updatedAt: new Date(),
    };

    this.versions.set(saved.id, saved);

    const current = this.versionCounters.get(saved.courseId) ?? 0;
    if (saved.version > current) {
      this.versionCounters.set(saved.courseId, saved.version);
    }

    return saved;
  }

  async findById(
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersion | null> {
    const version = this.versions.get(courseVersionId);
    if (!version || version.schoolId !== schoolId) {
      return null;
    }
    return version;
  }

  async list(
    schoolId: string,
    options: ListCourseVersionsOptions,
  ): Promise<PaginatedResult<CourseVersionSummary>> {
    const all = Array.from(this.versions.values())
      .filter((v) => v.schoolId === schoolId)
      .filter((v) => (options.status ? v.status === options.status : true))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((v) => toSummary(v));

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findPublishedByCourseId(
    schoolId: string,
    courseId: string,
  ): Promise<CourseVersion | null> {
    return (
      Array.from(this.versions.values()).find(
        (v) =>
          v.schoolId === schoolId &&
          v.courseId === courseId &&
          v.status === "PUBLISHED",
      ) ?? null
    );
  }

  async findDraftsByCourseId(
    schoolId: string,
    courseId: string,
  ): Promise<readonly CourseVersion[]> {
    return Array.from(this.versions.values()).filter(
      (v) =>
        v.schoolId === schoolId &&
        v.courseId === courseId &&
        v.status === "DRAFT",
    );
  }

  async publish(
    schoolId: string,
    courseVersionId: string,
    publishedAt: Date,
  ): Promise<CourseVersion | null> {
    const version = await this.findById(schoolId, courseVersionId);
    if (!version) {
      return null;
    }

    const published: CourseVersion = {
      ...version,
      status: "PUBLISHED",
      publishedAt,
      updatedAt: new Date(),
    };

    this.versions.set(published.id, published);
    return published;
  }

  async retire(
    schoolId: string,
    courseVersionId: string,
    retiredAt: Date,
  ): Promise<CourseVersion | null> {
    const version = await this.findById(schoolId, courseVersionId);
    if (!version) {
      return null;
    }

    const retired: CourseVersion = {
      ...version,
      status: "RETIRED",
      retiredAt,
      updatedAt: new Date(),
    };

    this.versions.set(retired.id, retired);
    return retired;
  }
}
