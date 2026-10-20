import type {
  CourseActivityPracticeWriteResult,
  CoursePracticeOption,
  CourseVersion,
  CourseVersionSummary,
} from "../../../src/modules/curriculum/domain/course-version.types.js";
import { toSummary } from "../../../src/modules/curriculum/domain/course-version.types.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
  PaginatedResult,
  SaveCourseActivityPracticeInput,
  SaveCourseVersionOptions,
} from "../../../src/modules/curriculum/ports/course-version-repository.port.js";
import {
  CurriculumConflictException,
  CurriculumNotFoundException,
} from "../../../src/modules/curriculum/domain/curriculum.errors.js";

export class FakeCourseVersionRepository implements CourseVersionRepositoryPort {
  private readonly versions = new Map<string, CourseVersion>();
  private readonly versionCounters = new Map<string, number>();
  private readonly practiceOptions = new Map<string, CoursePracticeOption>();

  add(...versions: CourseVersion[]): void {
    for (const version of versions) {
      this.versions.set(version.id, version);
      const current = this.versionCounters.get(version.courseId) ?? 0;
      if (version.version > current) {
        this.versionCounters.set(version.courseId, version.version);
      }
    }
  }

  addPracticeOptions(...options: CoursePracticeOption[]): void {
    for (const option of options) this.practiceOptions.set(option.id, option);
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

  listCoursePracticeOptions(
    _schoolId: string,
  ): Promise<readonly CoursePracticeOption[]> {
    void _schoolId;
    return Promise.resolve([...this.practiceOptions.values()]);
  }

  async saveActivityPractice(
    input: SaveCourseActivityPracticeInput,
  ): Promise<CourseActivityPracticeWriteResult> {
    const version = await this.findById(input.schoolId, input.courseVersionId);
    if (!version) throw new CurriculumNotFoundException();
    const option = this.practiceOptions.get(input.practiceDefinitionId);
    if (!option) throw new CurriculumNotFoundException("可用课程练习不存在");
    const activity = version.units
      .flatMap((unit) => unit.lessons)
      .flatMap((lesson) => lesson.activities)
      .find((entry) => entry.id === input.activityId);
    if (!activity) throw new CurriculumNotFoundException("课程活动不存在");
    const existing = activity.practiceReference;
    if (
      existing?.practiceDefinitionId === input.practiceDefinitionId &&
      existing.required === input.required
    ) {
      return {
        id: `course-practice-${input.activityId}`,
        courseVersionId: input.courseVersionId,
        activityId: input.activityId,
        practiceDefinitionId: option.id,
        title: option.title,
        required: input.required,
        courseVersionUpdatedAt: version.updatedAt,
      };
    }
    if (version.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new CurriculumConflictException("课程版本已被其他修改更新，请重新载入后再保存");
    }
    const updatedAt = new Date(version.updatedAt.getTime() + 1);
    const updated: CourseVersion = {
      ...version,
      updatedAt,
      units: version.units.map((unit) => ({
        ...unit,
        lessons: unit.lessons.map((lesson) => ({
          ...lesson,
          activities: lesson.activities.map((entry) =>
            entry.id === input.activityId
              ? {
                  ...entry,
                  practiceReference: {
                    practiceDefinitionId: option.id,
                    title: option.title,
                    required: input.required,
                  },
                }
              : entry,
          ),
        })),
      })),
    };
    this.versions.set(updated.id, updated);
    return {
      id: `course-practice-${input.activityId}`,
      courseVersionId: input.courseVersionId,
      activityId: input.activityId,
      practiceDefinitionId: option.id,
      title: option.title,
      required: input.required,
      courseVersionUpdatedAt: updatedAt,
    };
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
