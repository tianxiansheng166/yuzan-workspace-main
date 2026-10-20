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
  findById(_schoolId: string, _classId: string): Promise<Class | null> {
    void _schoolId;
    void _classId;
    return Promise.reject(new ClassUnavailableException());
  }

  findVisibleClassById(
    _options: FindVisibleClassOptions,
  ): Promise<Class | null> {
    void _options;
    return Promise.reject(new ClassUnavailableException());
  }

  list(
    _schoolId: string,
    _options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>> {
    void _schoolId;
    void _options;
    return Promise.reject(new ClassUnavailableException());
  }

  listMembers(
    _schoolId: string,
    _classId: string,
  ): Promise<readonly ClassMember[]> {
    void _schoolId;
    void _classId;
    return Promise.reject(new ClassUnavailableException());
  }

  listEnrollmentsByUser(
    _schoolId: string,
    _userId: string,
  ): Promise<readonly ClassEnrollment[]> {
    void _schoolId;
    void _userId;
    return Promise.reject(new ClassUnavailableException());
  }

  save(_input: CreateClassInput): Promise<Class> {
    void _input;
    return Promise.reject(new ClassUnavailableException());
  }

  update(
    _schoolId: string,
    _classId: string,
    _data: UpdateClassInput,
    _expectedUpdatedAt: Date,
  ): Promise<Class> {
    void _schoolId;
    void _classId;
    void _data;
    void _expectedUpdatedAt;
    return Promise.reject(new ClassUnavailableException());
  }

  softDelete(_schoolId: string, _classId: string): Promise<void> {
    void _schoolId;
    void _classId;
    return Promise.reject(new ClassUnavailableException());
  }

  addEnrollment(
    _schoolId: string,
    _classId: string,
    _userId: string,
    _role: MembershipRole,
  ): Promise<ClassEnrollment> {
    void _schoolId;
    void _classId;
    void _userId;
    void _role;
    return Promise.reject(new ClassUnavailableException());
  }

  removeEnrollment(
    _schoolId: string,
    _classId: string,
    _enrollmentId: string,
  ): Promise<void> {
    void _schoolId;
    void _classId;
    void _enrollmentId;
    return Promise.reject(new ClassUnavailableException());
  }

  listEnrollmentsByClass(
    _schoolId: string,
    _classId: string,
  ): Promise<readonly ClassEnrollment[]> {
    void _schoolId;
    void _classId;
    return Promise.reject(new ClassUnavailableException());
  }
}
