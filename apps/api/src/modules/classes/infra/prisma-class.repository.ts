import { Inject, Injectable } from "@nestjs/common";
import { MembershipRole } from "../../../common/security/membership-role.js";
import type { MembershipStatus } from "../../../common/security/index.js";
import { ClassUnavailableException } from "../domain/class.errors.js";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
} from "../domain/class.types.js";
import type {
  ClassRepositoryPort,
  FindVisibleClassOptions,
  ListClassesOptions,
  PaginatedResult,
} from "../ports/class-repository.port.js";
import { PrismaService } from "../../organizations/infra/prisma/prisma.service.js";
import type {
  Class as PrismaClass,
  Enrollment as PrismaEnrollment,
} from "../../organizations/infra/prisma/generated/client.js";

const ACTIVE = "ACTIVE" as const;

@Injectable()
export class PrismaClassRepository implements ClassRepositoryPort {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findById(schoolId: string, classId: string): Promise<Class | null> {
    try {
      const row = await this.prisma.class.findUnique({
        where: { schoolId_id: { schoolId, id: classId } },
        include: { enrollments: { where: { status: ACTIVE } } },
      });
      return row ? toClass(row, row.enrollments) : null;
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async findVisibleClassById(
    options: FindVisibleClassOptions,
  ): Promise<Class | null> {
    const { schoolId, classId, actor } = options;
    try {
      const row = await this.prisma.class.findUnique({
        where: { schoolId_id: { schoolId, id: classId } },
        include: { enrollments: { where: { status: ACTIVE } } },
      });
      if (!row) {
        return null;
      }

      if (actor.roles.includes(MembershipRole.SCHOOL_ADMIN)) {
        return toClass(row, row.enrollments);
      }

      if (actor.roles.includes(MembershipRole.TEACHER)) {
        const isResponsible = row.enrollments.some(
          (enrollment) =>
            enrollment.userId === actor.userId &&
            enrollment.role === MembershipRole.TEACHER,
        );
        if (isResponsible) {
          return toClass(row, row.enrollments);
        }
      }

      return null;
    } catch {
      throw new ClassUnavailableException();
    }
  }

  async list(
    schoolId: string,
    options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>> {
    try {
      const where = buildClassWhere(schoolId, options);
      const [rows, counts] = await this.prisma.$transaction([
        this.prisma.class.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: options.limit + 1,
          ...(options.cursor
            ? { cursor: { id: options.cursor }, skip: 1 }
            : {}),
        }),
        this.prisma.enrollment.groupBy({
          by: ["classId"],
          orderBy: { classId: "asc" },
          where: {
            schoolId,
            role: MembershipRole.STUDENT,
            status: ACTIVE,
          },
          _count: { classId: true },
        }),
      ]);

      const countByClass = new Map(
        counts.map((countRow) => [
          countRow.classId,
          countRow._count && typeof countRow._count === "object"
            ? countRow._count.classId
            : 0,
        ]),
      );

      const hasMore = rows.length > options.limit;
      const visibleRows = rows.slice(0, options.limit);
      const items = visibleRows.map((classRow) =>
        toClassSummary(classRow, countByClass.get(classRow.id) ?? 0),
      );

      return {
        items,
        nextCursor: hasMore
          ? (visibleRows[visibleRows.length - 1]?.id ?? null)
          : null,
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
      const classRow = await this.prisma.class.findUnique({
        where: { schoolId_id: { schoolId, id: classId } },
      });
      if (!classRow) {
        return [];
      }

      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          schoolId,
          classId,
          status: ACTIVE,
          role: { in: [MembershipRole.TEACHER, MembershipRole.STUDENT] },
        },
        include: { user: true },
        orderBy: { joinedAt: "desc" },
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
        where: {
          schoolId,
          userId,
          status: ACTIVE,
          role: { in: [MembershipRole.TEACHER, MembershipRole.STUDENT] },
        },
        orderBy: { joinedAt: "desc" },
      });
      return rows.map(toClassEnrollment);
    } catch {
      throw new ClassUnavailableException();
    }
  }
}

function buildClassWhere(
  schoolId: string,
  options: ListClassesOptions,
): { schoolId: string; enrollments?: object } {
  const where: { schoolId: string; enrollments?: object } = { schoolId };
  if (options.teacherUserId) {
    where.enrollments = {
      some: {
        userId: options.teacherUserId,
        role: MembershipRole.TEACHER,
        status: ACTIVE,
      },
    };
  } else if (options.studentUserId) {
    where.enrollments = {
      some: {
        userId: options.studentUserId,
        role: MembershipRole.STUDENT,
        status: ACTIVE,
      },
    };
  }
  return where;
}

function toClass(row: PrismaClass, enrollments: PrismaEnrollment[]): Class {
  const teacherUserIds = enrollments
    .filter((enrollment) => enrollment.role === MembershipRole.TEACHER)
    .map((enrollment) => enrollment.userId);
  const studentCount = enrollments.filter(
    (enrollment) => enrollment.role === MembershipRole.STUDENT,
  ).length;

  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    grade: row.grade,
    teacherUserIds,
    studentCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toClassSummary(row: PrismaClass, studentCount: number): ClassSummary {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    studentCount,
  };
}

function toClassMember(
  row: PrismaEnrollment & { user: { displayName: string } },
): ClassMember {
  return {
    userId: row.userId,
    displayName: row.user.displayName,
    roleInClass: row.role as MembershipRole.TEACHER | MembershipRole.STUDENT,
    status: row.status as MembershipStatus,
  };
}

function toClassEnrollment(row: PrismaEnrollment): ClassEnrollment {
  return {
    classId: row.classId,
    schoolId: row.schoolId,
    userId: row.userId,
    roleInClass: row.role as MembershipRole.TEACHER | MembershipRole.STUDENT,
  };
}
