import { Injectable } from "@nestjs/common";
import type {
  CourseVersion,
  CourseVersionSummary,
} from "../domain/course-version.types.js";
import { CurriculumRepositoryUnavailableException } from "../domain/curriculum.errors.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
  PaginatedResult,
  SaveCourseVersionOptions,
} from "./course-version-repository.port.js";

@Injectable()
export class UnavailableCourseVersionRepository implements CourseVersionRepositoryPort {
  private fail(): never {
    throw new CurriculumRepositoryUnavailableException();
  }

  async nextVersion(_schoolId: string, _courseId: string): Promise<number> {
    this.fail();
  }

  async save(
    _version: CourseVersion,
    _options?: SaveCourseVersionOptions,
  ): Promise<CourseVersion> {
    this.fail();
  }

  async findById(
    _schoolId: string,
    _courseVersionId: string,
  ): Promise<CourseVersion | null> {
    this.fail();
  }

  async list(
    _schoolId: string,
    _options: ListCourseVersionsOptions,
  ): Promise<PaginatedResult<CourseVersionSummary>> {
    this.fail();
  }

  async findPublishedByCourseId(
    _schoolId: string,
    _courseId: string,
  ): Promise<CourseVersion | null> {
    this.fail();
  }

  async findDraftsByCourseId(
    _schoolId: string,
    _courseId: string,
  ): Promise<readonly CourseVersion[]> {
    this.fail();
  }

  async publish(
    _schoolId: string,
    _courseVersionId: string,
    _publishedAt: Date,
  ): Promise<CourseVersion | null> {
    this.fail();
  }

  async retire(
    _schoolId: string,
    _courseVersionId: string,
    _retiredAt: Date,
  ): Promise<CourseVersion | null> {
    this.fail();
  }
}
