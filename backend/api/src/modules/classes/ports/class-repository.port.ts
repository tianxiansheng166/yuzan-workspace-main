import type { MembershipRole } from "../../../common/security/index.js";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
  CreateClassInput,
  UpdateClassInput,
} from "../domain/class.types.js";

export const CLASS_REPOSITORY = Symbol("CLASS_REPOSITORY");

export interface ListClassesOptions {
  readonly teacherUserId?: string;
  readonly studentUserId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ClassActor {
  readonly userId: string;
  readonly roles: readonly MembershipRole[];
}

export interface FindVisibleClassOptions {
  readonly schoolId: string;
  readonly classId: string;
  readonly actor: ClassActor;
}

export interface ClassRepositoryPort {
  findById(schoolId: string, classId: string): Promise<Class | null>;
  findVisibleClassById(options: FindVisibleClassOptions): Promise<Class | null>;
  list(
    schoolId: string,
    options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>>;
  listMembers(
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassMember[]>;
  listEnrollmentsByUser(
    schoolId: string,
    userId: string,
  ): Promise<readonly ClassEnrollment[]>;
  save(input: CreateClassInput): Promise<Class>;
  update(
    schoolId: string,
    classId: string,
    data: UpdateClassInput,
    expectedUpdatedAt: Date,
  ): Promise<Class>;
  softDelete(schoolId: string, classId: string): Promise<void>;
  addEnrollment(
    schoolId: string,
    classId: string,
    userId: string,
    role: MembershipRole,
  ): Promise<ClassEnrollment>;
  removeEnrollment(
    schoolId: string,
    classId: string,
    enrollmentId: string,
  ): Promise<void>;
  listEnrollmentsByClass(
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassEnrollment[]>;
}
