import { Injectable } from "@nestjs/common";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
} from "../../classes/domain/class.types.js";
import type {
  ClassRepositoryPort,
  FindVisibleClassOptions,
  ListClassesOptions,
  PaginatedResult,
} from "../../classes/ports/class-repository.port.js";
import { AssignmentUnavailableException } from "../domain/assignment.errors.js";

@Injectable()
export class UnavailableClassRepository implements ClassRepositoryPort {
  findById(_schoolId: string, _classId: string): Promise<Class | null> {
    throw new AssignmentUnavailableException();
  }

  findVisibleClassById(
    _options: FindVisibleClassOptions,
  ): Promise<Class | null> {
    throw new AssignmentUnavailableException();
  }

  hasActiveStudentEnrollment(
    _schoolId: string,
    _classId: string,
    _userId: string,
  ): Promise<boolean> {
    throw new AssignmentUnavailableException();
  }

  list(
    _schoolId: string,
    _options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>> {
    throw new AssignmentUnavailableException();
  }

  listMembers(
    _schoolId: string,
    _classId: string,
  ): Promise<readonly ClassMember[]> {
    throw new AssignmentUnavailableException();
  }

  listEnrollmentsByUser(
    _schoolId: string,
    _userId: string,
  ): Promise<readonly ClassEnrollment[]> {
    throw new AssignmentUnavailableException();
  }
}
