import type {
  Class,
  ClassEnrollment,
} from "../../../src/modules/classes/domain/class.types.js";
import { MembershipRole } from "../../../src/common/security/index.js";

export function classEntity(
  overrides: Partial<Class> & Pick<Class, "id" | "schoolId" | "name" | "grade">,
): Class {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    teacherUserIds: [],
    studentCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function studentEnrollment(
  classId: string,
  schoolId: string,
  userId: string,
): ClassEnrollment {
  return {
    classId,
    schoolId,
    userId,
    roleInClass: MembershipRole.STUDENT,
  };
}

export function teacherEnrollment(
  classId: string,
  schoolId: string,
  userId: string,
): ClassEnrollment {
  return {
    classId,
    schoolId,
    userId,
    roleInClass: MembershipRole.TEACHER,
  };
}
