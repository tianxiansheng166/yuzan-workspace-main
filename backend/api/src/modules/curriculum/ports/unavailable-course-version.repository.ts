import { Injectable } from "@nestjs/common";
import type {
  CourseActivityPracticeWriteResult,
  CoursePracticeOption,
  CourseVersion,
  CourseVersionSummary,
} from "../domain/course-version.types.js";
import { CurriculumRepositoryUnavailableException } from "../domain/curriculum.errors.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
  PaginatedResult,
  SaveCourseVersionOptions,
  SaveCourseActivityPracticeInput,
} from "./course-version-repository.port.js";

@Injectable()
export class UnavailableCourseVersionRepository implements CourseVersionRepositoryPort {
  private fail(): Promise<never> {
    return Promise.reject(new CurriculumRepositoryUnavailableException());
  }

  nextVersion(_schoolId: string, _courseId: string): Promise<number> {
    void _schoolId;
    void _courseId;
    return this.fail();
  }

  save(
    _version: CourseVersion,
    _options?: SaveCourseVersionOptions,
  ): Promise<CourseVersion> {
    void _version;
    void _options;
    return this.fail();
  }

  findById(
    _schoolId: string,
    _courseVersionId: string,
  ): Promise<CourseVersion | null> {
    void _schoolId;
    void _courseVersionId;
    return this.fail();
  }

  list(
    _schoolId: string,
    _options: ListCourseVersionsOptions,
  ): Promise<PaginatedResult<CourseVersionSummary>> {
    void _schoolId;
    void _options;
    return this.fail();
  }

  findPublishedByCourseId(
    _schoolId: string,
    _courseId: string,
  ): Promise<CourseVersion | null> {
    void _schoolId;
    void _courseId;
    return this.fail();
  }

  findDraftsByCourseId(
    _schoolId: string,
    _courseId: string,
  ): Promise<readonly CourseVersion[]> {
    void _schoolId;
    void _courseId;
    return this.fail();
  }

  listCoursePracticeOptions(
    _schoolId: string,
  ): Promise<readonly CoursePracticeOption[]> {
    void _schoolId;
    return this.fail();
  }

  saveActivityPractice(
    _input: SaveCourseActivityPracticeInput,
  ): Promise<CourseActivityPracticeWriteResult> {
    void _input;
    return this.fail();
  }

  publish(
    _schoolId: string,
    _courseVersionId: string,
    _publishedAt: Date,
  ): Promise<CourseVersion | null> {
    void _schoolId;
    void _courseVersionId;
    void _publishedAt;
    return this.fail();
  }

  retire(
    _schoolId: string,
    _courseVersionId: string,
    _retiredAt: Date,
  ): Promise<CourseVersion | null> {
    void _schoolId;
    void _courseVersionId;
    void _retiredAt;
    return this.fail();
  }
}
