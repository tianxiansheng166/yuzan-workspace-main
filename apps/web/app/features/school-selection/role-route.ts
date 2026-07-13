import type { MembershipRole } from "./types";

export function isMembershipRole(role: string): role is MembershipRole {
  return [
    "STUDENT",
    "TEACHER",
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
    case "SCHOOL_ADMIN":
      return "/admin";
    case "PLATFORM_ADMIN":
      return "/admin";
    case "RESEARCHER":
      return "/research";
  }

  return "/login?reason=unsupported-role";
}
