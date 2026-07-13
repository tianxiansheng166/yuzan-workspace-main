import type { UserRole } from "../models";

const ROLE_MAP: Readonly<Record<string, UserRole>> = {
  student: "student",
  teacher: "teacher",
  volunteer: "volunteer",
  researcher: "researcher",
  school_admin: "admin",
  platform_admin: "admin",
  admin: "admin",
  unassigned: "unassigned",
};

export function normalizeRole(role: string | undefined): UserRole | undefined {
  if (!role) {
    return undefined;
  }

  const normalizedRole = role.trim().toLowerCase();

  return ROLE_MAP[normalizedRole];
}

export function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "student":
      return "/student/today";
    case "teacher":
      return "/teacher";
    case "volunteer":
      return "/volunteer";
    case "researcher":
      return "/research";
    case "admin":
      return "/admin";
    case "unassigned":
      return "/select-school";
  }
}
