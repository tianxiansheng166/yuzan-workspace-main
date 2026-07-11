import type { MembershipRole } from "./types";

export function isMembershipRole(role: string): role is MembershipRole {
  return [
    "STUDENT",
    "TEACHER",
    "VOLUNTEER",
    "RESEARCHER",
    "SCHOOL_ADMIN",
    "PLATFORM_ADMIN",
  ].includes(role);
}

export function routeForMembershipRole(role: MembershipRole): string {
  switch (role) {
    case "STUDENT":
      return "/student/today";
    case "TEACHER":
      return "/teacher";
    case "VOLUNTEER":
      return "/training/volunteer";
    case "SCHOOL_ADMIN":
      return "/teacher?state=school-admin-pending";
    case "PLATFORM_ADMIN":
      return "/studio";
    case "RESEARCHER":
      return "/?state=researcher-pending";
  }
}
