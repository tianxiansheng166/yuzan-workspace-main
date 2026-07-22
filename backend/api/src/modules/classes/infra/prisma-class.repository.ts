import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { sanitizeDriverError } from "../../../shared/database/database.errors.js";
import { MembershipRole } from "../../../common/security/index.js";
import { MembershipStatus } from "../../../common/security/auth.types.js";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
  CreateClassInput,
  UpdateClassInput,
} from "../domain/class.types.js";
import {
  ClassConflictException,
  ClassUnavailableException,
  EnrollmentConflictException,
} from "../domain/class.errors.js";
import type {
  ClassRepositoryPort,
  FindVisibleClassOptions,
  ListClassesOptions,
  PaginatedResult,
} from "../ports/class-repository.port.js";
import type { ClassEnrollmentLookupPort } from "../ports/class-enrollment-lookup.port.js";

type ClassRow = Prisma.ClassGetPayload<{
  include: { enrollments: true };
}>;

@Injectable()
export class PrismaClassRepository
  implements ClassRepositoryPort, ClassEnrollmentLookupPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(schoolId: string, classId: string): Promise<Class | null> {
    try {
      const row = await this.prisma.class.findFirst({
        where: { id: classId, schoolId },
        include: { enrollments: { where: { status: "ACTIVE" } } },
      });
      return row ? toClass(row) : null;
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async findVisibleClassById(
    options: FindVisibleClassOptions,
  ): Promise<Class | null> {
    return this.findById(options.schoolId, options.classId);
  }

  async list(
    schoolId: string,
    options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>> {
    try {
      const where: Prisma.ClassWhereInput = {
        schoolId,
      };

      if (options.studentUserId) {
        where.enrollments = {
          some: {
            userId: options.studentUserId,
            status: "ACTIVE",
            role: "STUDENT",
          },
        };
      }

      if (options.teacherUserId) {
        where.enrollments = {
          some: {
            userId: options.teacherUserId,
            status: "ACTIVE",
            role: "TEACHER",
          },
        };
      }

      if (options.cursor) {
        where.id = { gt: options.cursor };
      }

      const rows = await this.prisma.class.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit + 1,
        include: {
          _count: { select: { enrollments: { where: { role: "STUDENT", status: "ACTIVE" } } } },
        },
      });

      const hasMore = rows.length > options.limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

      return {
        items: items.map((r) => toClassSummary(r)),
        nextCursor,
        hasMore,
      };
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async listMembers(
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassMember[]> {
    try {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { schoolId, classId, status: "ACTIVE" },
        include: { user: true },
      });
      return enrollments.map(toClassMember);
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async listEnrollmentsByUser(
    schoolId: string,
    userId: string,
  ): Promise<readonly ClassEnrollment[]> {
    try {
      const rows = await this.prisma.enrollment.findMany({
        where: { schoolId, userId, status: "ACTIVE" },
      });
      return rows.map(toEnrollment);
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async save(input: CreateClassInput): Promise<Class> {
    try {
      const row = await this.prisma.class.create({
        data: {
          schoolId: input.schoolId,
          termId: input.termId,
          campusId: input.campusId ?? null,
          name: input.name,
          grade: input.grade,
        },
        include: { enrollments: { where: { status: "ACTIVE" } } },
      });
      return toClass(row);
    } catch (err) {
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new ClassConflictException("班级名称已存在");
      }
      throw new ClassUnavailableException();
    }
  }

  async update(
    schoolId: string,
    classId: string,
    data: UpdateClassInput,
    expectedUpdatedAt: Date,
  ): Promise<Class> {
    try {
      const result = await this.prisma.class.updateMany({
        where: { id: classId, schoolId, updatedAt: expectedUpdatedAt },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.grade ? { grade: data.grade } : {}),
        },
      });

      if (result.count !== 1) {
        throw new ClassConflictException();
      }

      return (await this.findById(schoolId, classId))!;
    } catch (err) {
      if (err instanceof ClassConflictException) throw err;
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new ClassConflictException("班级名称已存在");
      }
      throw new ClassUnavailableException();
    }
  }

  async softDelete(schoolId: string, classId: string): Promise<void> {
    try {
      await this.prisma.class.deleteMany({
        where: { id: classId, schoolId },
      });
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async addEnrollment(
    schoolId: string,
    classId: string,
    userId: string,
    role: MembershipRole,
  ): Promise<ClassEnrollment> {
    try {
      const row = await this.prisma.enrollment.create({
        data: {
          schoolId,
          classId,
          userId,
          role,
          status: "ACTIVE",
        },
      });
      return toEnrollment(row);
    } catch (err) {
      const safe = sanitizeDriverError(err);
      if (safe.code === "DATABASE_CONFLICT") {
        throw new EnrollmentConflictException();
      }
      throw new ClassUnavailableException();
    }
  }

  async removeEnrollment(
    schoolId: string,
    _classId: string,
    enrollmentId: string,
  ): Promise<void> {
    try {
      await this.prisma.enrollment.updateMany({
        where: { id: enrollmentId, schoolId, status: "ACTIVE" },
        data: { status: "LEFT" },
      });
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async listEnrollmentsByClass(
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassEnrollment[]> {
    try {
      const rows = await this.prisma.enrollment.findMany({
        where: { schoolId, classId, status: "ACTIVE" },
      });
      return rows.map(toEnrollment);
    } catch {
      throw new ClassUnavailableException();
    }
  }

  // ClassEnrollmentLookupPort implementation
  async classExistsAndBelongsToSchool(
    schoolId: string,
    classId: string,
  ): Promise<boolean> {
    try {
      const count = await this.prisma.class.count({
        where: { id: classId, schoolId },
      });
      return count > 0;
    } catch {
      return false;
    }
  }

  async isUserEnrolledInClass(
    schoolId: string,
    classId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const count = await this.prisma.enrollment.count({
        where: { schoolId, classId, userId, status: "ACTIVE" },
      });
      return count > 0;
    } catch {
      return false;
    }
  }

  async listStudentEnrollmentIds(
    schoolId: string,
    classId: string,
  ): Promise<readonly string[]> {
    try {
      const rows = await this.prisma.enrollment.findMany({
        where: { schoolId, classId, role: "STUDENT", status: "ACTIVE" },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    } catch {
      return [];
    }
  }

  async findEnrollmentId(
    schoolId: string,
    userId: string,
    classId: string,
  ): Promise<string | null> {
    try {
      const row = await this.prisma.enrollment.findFirst({
        where: { schoolId, userId, classId, status: "ACTIVE" },
        select: { id: true },
      });
      return row?.id ?? null;
    } catch {
      return null;
    }
  }
}

function toClass(row: ClassRow): Class {
  const teacherIds = row.enrollments
    .filter((e) => e.role === "TEACHER")
    .map((e) => e.userId);
  const studentCount = row.enrollments.filter(
    (e) => e.role === "STUDENT",
  ).length;

  return {
    id: row.id,
    schoolId: row.schoolId,
    termId: row.termId,
    ...(row.campusId ? { campusId: row.campusId } : {}),
    name: row.name,
    grade: row.grade,
    teacherUserIds: teacherIds,
    studentCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toClassSummary(
  row: Prisma.ClassGetPayload<{
    include: {
      _count: { select: { enrollments: { where: { role: "STUDENT"; status: "ACTIVE" } } } };
    };
  }>,
): ClassSummary {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    studentCount: row._count.enrollments,
  };
}

function toClassMember(
  row: Prisma.EnrollmentGetPayload<{ include: { user: true } }>,
): ClassMember {
  return {
    userId: row.userId,
    displayName: row.user.displayName,
    roleInClass: row.role as MembershipRole.TEACHER | MembershipRole.STUDENT,
    status: row.status as MembershipStatus.ACTIVE | MembershipStatus.INVITED | MembershipStatus.SUSPENDED | MembershipStatus.LEFT,
  };
}

function toEnrollment(
  row: Prisma.EnrollmentGetPayload<Record<string, never>>,
): ClassEnrollment {
  return {
    id: row.id,
    classId: row.classId,
    schoolId: row.schoolId,
    userId: row.userId,
    roleInClass: row.role as MembershipRole.TEACHER | MembershipRole.STUDENT,
    status: row.status as MembershipStatus.ACTIVE | MembershipStatus.INVITED | MembershipStatus.SUSPENDED | MembershipStatus.LEFT,
  };
}
