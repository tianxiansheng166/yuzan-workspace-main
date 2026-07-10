import { Injectable } from "@nestjs/common";
import type {
  CourseVersion,
  CourseVersionSummary,
} from "../../curriculum/domain/course-version.types.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
  PaginatedResult,
  SaveCourseVersionOptions,
} from "../../curriculum/ports/course-version-repository.port.js";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";

@Injectable()
export class UnavailableCourseVersionRepository implements CourseVersionRepositoryPort {
  nextVersion(_courseId: string): Promise<number> {
    throw new AssignmentUnavailableException();
  }

  save(
    _version: CourseVersion,
    _options?: SaveCourseVersionOptions,
  ): Promise<CourseVersion> {
    throw new AssignmentUnavailableException();
  }

  findById(
    _schoolId: string,
    _courseVersionId: string,
  ): Promise<CourseVersion | null> {
    throw new AssignmentUnavailableException();
  }

  list(
    _schoolId: string,
    _options: ListCourseVersionsOptions,
  ): Promise<PaginatedResult<CourseVersionSummary>> {
    throw new AssignmentUnavailableException();
  }

  findPublishedByCourseId(
    _schoolId: string,
    _courseId: string,
  ): Promise<CourseVersion | null> {
    throw new AssignmentUnavailableException();
  }

  findDraftsByCourseId(
    _schoolId: string,
    _courseId: string,
  ): Promise<readonly CourseVersion[]> {
    throw new AssignmentUnavailableException();
  }

  publish(
    _schoolId: string,
    _courseVersionId: string,
    _publishedAt: Date,
  ): Promise<CourseVersion | null> {
    throw new AssignmentUnavailableException();
  }

  retire(
    _schoolId: string,
    _courseVersionId: string,
    _retiredAt: Date,
  ): Promise<CourseVersion | null> {
    throw new AssignmentUnavailableException();
  }
}
