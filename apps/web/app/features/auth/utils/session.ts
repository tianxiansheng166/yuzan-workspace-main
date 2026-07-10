import type { CurrentUser } from "../../../lib/api/types";
import type { SchoolOption, UserRole, WebSession } from "../models";

const roleMap: Record<string, UserRole> = {
  STUDENT: "student",
  TEACHER: "teacher",
  RESEARCHER: "teacher",
  SCHOOL_ADMIN: "admin",
  PLATFORM_ADMIN: "admin",
};

export function toWebSession(user: CurrentUser): WebSession {
  const memberships = user.memberships.flatMap<SchoolOption>((membership) => {
    const role = roleMap[membership.role];
    return role ? [{ ...membership, role }] : [];
  });
  return {
    userId: user.id,
    displayName: user.displayName,
    memberships,
    activeSchoolId:
      memberships.length === 1 ? memberships[0]?.schoolId : undefined,
  };
}

export function homeForRole(role: UserRole) {
  if (role === "student") return "/student/today";
  if (role === "teacher") return "/teacher";
  return "/";
}
