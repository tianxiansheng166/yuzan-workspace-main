import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
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

export interface ClassRepositoryPort {
  findById(schoolId: string, classId: string): Promise<Class | null>;
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
}
