import type { UserIdentity } from "../../../src/modules/identity/identity.types.js";
import {
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import type { UserMembership } from "../../../src/modules/identity/identity.types.js";

export function activeStudent(): UserIdentity {
  return {
    id: "user-student-1",
    loginIdentifier: "student@example.edu",
    displayName: "学生一",
    preferredLocale: "zh-CN",
    status: "ACTIVE",
    passwordHash: "hash-student",
  };
}

export function activeTeacher(): UserIdentity {
  return {
    id: "user-teacher-1",
    loginIdentifier: "teacher@example.edu",
    displayName: "教师一",
    preferredLocale: "zh-CN",
    status: "ACTIVE",
    passwordHash: "hash-teacher",
  };
}

export function suspendedTeacher(): UserIdentity {
  return {
    id: "user-teacher-suspended",
    loginIdentifier: "suspended@example.edu",
    displayName: "被暂停教师",
    preferredLocale: "zh-CN",
    status: "ACTIVE",
    passwordHash: "hash-suspended",
  };
}

export function inactiveUser(): UserIdentity {
  return {
    id: "user-inactive-1",
    loginIdentifier: "inactive@example.edu",
    displayName: "未激活用户",
    preferredLocale: "zh-CN",
    status: "INACTIVE",
    passwordHash: "hash-inactive",
  };
}

export function studentMembership(userId = "user-student-1"): UserMembership {
  return {
    id: "membership-student-1",
    userId,
    schoolId: "school-a",
    schoolName: "示例学校 A",
    role: MembershipRole.STUDENT,
    status: MembershipStatus.ACTIVE,
  };
}

export function teacherMembership(
  userId = "user-teacher-1",
  schoolId = "school-a",
): UserMembership {
  return {
    id: `membership-teacher-${schoolId}`,
    userId,
    schoolId,
    schoolName: `示例学校 ${schoolId.toUpperCase()}`,
    role: MembershipRole.TEACHER,
    status: MembershipStatus.ACTIVE,
  };
}

export function schoolAdminMembership(userId = "user-admin-1"): UserMembership {
  return {
    id: "membership-admin-1",
    userId,
    schoolId: "school-a",
    schoolName: "示例学校 A",
    role: MembershipRole.SCHOOL_ADMIN,
    status: MembershipStatus.ACTIVE,
  };
}

export function platformAdminMembership(
  userId = "user-platform-admin-1",
): UserMembership {
  return {
    id: "membership-platform-admin-1",
    userId,
    schoolId: "platform",
    schoolName: "平台",
    role: MembershipRole.PLATFORM_ADMIN,
    status: MembershipStatus.ACTIVE,
  };
}

export function invitedMembership(userId = "user-invited-1"): UserMembership {
  return {
    id: "membership-invited-1",
    userId,
    schoolId: "school-a",
    schoolName: "示例学校 A",
    role: MembershipRole.TEACHER,
    status: MembershipStatus.INVITED,
  };
}

export function suspendedMembership(
  userId = "user-teacher-suspended",
): UserMembership {
  return {
    id: "membership-suspended-1",
    userId,
    schoolId: "school-a",
    schoolName: "示例学校 A",
    role: MembershipRole.TEACHER,
    status: MembershipStatus.SUSPENDED,
  };
}

export function leftMembership(userId = "user-left-1"): UserMembership {
  return {
    id: "membership-left-1",
    userId,
    schoolId: "school-a",
    schoolName: "示例学校 A",
    role: MembershipRole.TEACHER,
    status: MembershipStatus.LEFT,
  };
}
