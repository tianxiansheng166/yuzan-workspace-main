import type {
  Class,
  ClassMember,
  ClassSummary,
} from "../domain/class.types.js";

export interface ClassSummaryResponse {
  readonly id: string;
  readonly name: string;
  readonly grade: string;
  readonly studentCount: number;
}

export function toClassSummaryResponse(
  classItem: ClassSummary,
): ClassSummaryResponse {
  return {
    id: classItem.id,
    name: classItem.name,
    grade: classItem.grade,
    studentCount: classItem.studentCount,
  };
}

export interface ClassResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly name: string;
  readonly grade: string;
  readonly teacherUserIds: readonly string[];
  readonly studentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toClassResponse(classItem: Class): ClassResponse {
  return {
    id: classItem.id,
    schoolId: classItem.schoolId,
    name: classItem.name,
    grade: classItem.grade,
    teacherUserIds: classItem.teacherUserIds,
    studentCount: classItem.studentCount,
    createdAt: classItem.createdAt.toISOString(),
    updatedAt: classItem.updatedAt.toISOString(),
  };
}

export interface ClassMemberResponse {
  readonly userId: string;
  readonly displayName: string;
  readonly roleInClass: "TEACHER" | "STUDENT";
  readonly status: string;
}

export function toClassMemberResponse(
  member: ClassMember,
): ClassMemberResponse {
  return {
    userId: member.userId,
    displayName: member.displayName,
    roleInClass: member.roleInClass,
    status: member.status,
  };
}
