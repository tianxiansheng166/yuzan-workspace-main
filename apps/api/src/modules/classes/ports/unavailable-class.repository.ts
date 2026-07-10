import { Injectable } from "@nestjs/common";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
} from "../domain/class.types.js";
import { ClassUnavailableException } from "../domain/class.errors.js";
import type {
  ClassRepositoryPort,
  FindVisibleClassOptions,
  ListClassesOptions,
  PaginatedResult,
} from "./class-repository.port.js";

@Injectable()
export class UnavailableClassRepository implements ClassRepositoryPort {
  async findById(_schoolId: string, _classId: string): Promise<Class | null> {
    throw new ClassUnavailableException();
  }

  async findVisibleClassById(
    _options: FindVisibleClassOptions,
  ): Promise<Class | null> {
    throw new ClassUnavailableException();
  }

  async list(
    _schoolId: string,
    _options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>> {
    throw new ClassUnavailableException();
  }

  async listMembers(
    _schoolId: string,
    _classId: string,
  ): Promise<readonly ClassMember[]> {
    throw new ClassUnavailableException();
  }

  async listEnrollmentsByUser(
    _schoolId: string,
    _userId: string,
  ): Promise<readonly ClassEnrollment[]> {
    throw new ClassUnavailableException();
  }
}
