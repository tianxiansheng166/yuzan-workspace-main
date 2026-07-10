import { MembershipRole } from "../../../src/common/security/index.js";
import type {
  Class,
  ClassEnrollment,
  ClassMember,
  ClassSummary,
} from "../../../src/modules/classes/domain/class.types.js";
import type {
  ClassRepositoryPort,
  FindVisibleClassOptions,
  ListClassesOptions,
  PaginatedResult,
} from "../../../src/modules/classes/ports/class-repository.port.js";

export class FakeClassRepository implements ClassRepositoryPort {
  private readonly classes = new Map<string, Class>();
  private readonly enrollments = new Map<string, ClassEnrollment[]>();

  add(...classes: Class[]): void {
    for (const c of classes) {
      this.classes.set(c.id, c);
    }
  }

  enroll(classId: string, ...enrollments: ClassEnrollment[]): void {
    const existing = this.enrollments.get(classId) ?? [];
    this.enrollments.set(classId, [...existing, ...enrollments]);
  }

  async findById(schoolId: string, classId: string): Promise<Class | null> {
    const classItem = this.classes.get(classId);
    if (!classItem || classItem.schoolId !== schoolId) {
      return null;
    }
    return classItem;
  }

  async findVisibleClassById(
    options: FindVisibleClassOptions,
  ): Promise<Class | null> {
    const { schoolId, classId, actor } = options;
    const classItem = this.classes.get(classId);
    if (!classItem || classItem.schoolId !== schoolId) {
      return null;
    }

    if (actor.roles.includes(MembershipRole.SCHOOL_ADMIN)) {
      return classItem;
    }

    if (
      actor.roles.includes(MembershipRole.TEACHER) &&
      classItem.teacherUserIds.includes(actor.userId)
    ) {
      return classItem;
    }

    return null;
  }

  async list(
    schoolId: string,
    options: ListClassesOptions,
  ): Promise<PaginatedResult<ClassSummary>> {
    let all = Array.from(this.classes.values()).filter(
      (c) => c.schoolId === schoolId,
    );

    if (options.teacherUserId) {
      all = all.filter((c) =>
        c.teacherUserIds.includes(options.teacherUserId!),
      );
    }

    if (options.studentUserId) {
      const classIds = new Set(
        Array.from(this.enrollments.entries())
          .filter(([, list]) =>
            list.some(
              (e) =>
                e.userId === options.studentUserId &&
                e.roleInClass === "STUDENT",
            ),
          )
          .map(([id]) => id),
      );
      all = all.filter((c) => classIds.has(c.id));
    }

    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit).map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      studentCount: c.studentCount,
    }));

    return {
      items,
      nextCursor: all.length > start + limit ? String(start + limit) : null,
      hasMore: all.length > start + limit,
    };
  }

  async listMembers(
    schoolId: string,
    classId: string,
  ): Promise<readonly ClassMember[]> {
    const classItem = await this.findById(schoolId, classId);
    if (!classItem) {
      return [];
    }

    const members: ClassMember[] = classItem.teacherUserIds.map((userId) => ({
      userId,
      displayName: `Teacher ${userId}`,
      roleInClass: "TEACHER",
      status: "ACTIVE",
    }));

    const enrolls = this.enrollments.get(classId) ?? [];
    for (const e of enrolls) {
      members.push({
        userId: e.userId,
        displayName: `Student ${e.userId}`,
        roleInClass: e.roleInClass,
        status: "ACTIVE",
      });
    }

    return members;
  }

  async listEnrollmentsByUser(
    schoolId: string,
    userId: string,
  ): Promise<readonly ClassEnrollment[]> {
    const results: ClassEnrollment[] = [];
    for (const [classId, list] of this.enrollments.entries()) {
      const classItem = this.classes.get(classId);
      if (classItem?.schoolId !== schoolId) continue;
      for (const e of list) {
        if (e.userId === userId) {
          results.push(e);
        }
      }
    }
    return results;
  }
}
