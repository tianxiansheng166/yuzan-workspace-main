import { Injectable } from "@nestjs/common";
import type { MembershipRole } from "../../../common/security/index.js";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
  CreateClassInput,
  UpdateClassInput,
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

  async save(_input: CreateClassInput): Promise<Class> {
    throw new ClassUnavailableException();
  }

  async update(
    _schoolId: string,
    _classId: string,
    _data: UpdateClassInput,
    _expectedUpdatedAt: Date,
  ): Promise<Class> {
    throw new ClassUnavailableException();
  }

  async softDelete(_schoolId: string, _classId: string): Promise<void> {
    throw new ClassUnavailableException();
  }

  async addEnrollment(
    _schoolId: string,
    _classId: string,
    _userId: string,
    _role: MembershipRole,
  ): Promise<ClassEnrollment> {
    throw new ClassUnavailableException();
  }

  async removeEnrollment(
    _schoolId: string,
    _classId: string,
    _enrollmentId: string,
  ): Promise<void> {
    throw new ClassUnavailableException();
  }

  async listEnrollmentsByClass(
    _schoolId: string,
    _classId: string,
  ): Promise<readonly ClassEnrollment[]> {
    throw new ClassUnavailableException();
  }
}
