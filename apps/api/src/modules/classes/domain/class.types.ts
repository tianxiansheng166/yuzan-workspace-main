import type {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";

export interface Class {
  readonly id: string;
  readonly schoolId: string;
  readonly name: string;
  readonly grade: string;
  readonly teacherUserIds: readonly string[];
  readonly studentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ClassSummary {
  readonly id: string;
  readonly name: string;
  readonly grade: string;
  readonly studentCount: number;
}

export interface ClassMember {
  readonly userId: string;
  readonly displayName: string;
  readonly roleInClass: MembershipRole.TEACHER | MembershipRole.STUDENT;
  readonly status: MembershipStatus;
}

export interface ClassEnrollment {
  readonly classId: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly roleInClass: MembershipRole.TEACHER | MembershipRole.STUDENT;
}
