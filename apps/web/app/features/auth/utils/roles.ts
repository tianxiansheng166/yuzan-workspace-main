import type { UserRole } from "../models";

const KNOWN_ROLES: readonly UserRole[] = ["student", "teacher", "admin"];

export function normalizeRole(role: string | undefined): UserRole | undefined {
  if (!role) {
    return undefined;
  }

  const normalizedRole = role.trim().toLowerCase();

  return KNOWN_ROLES.find((item) => item === normalizedRole);
}

export function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "student":
      return "/student/today";
    case "teacher":
      return "/teacher";
    case "admin":
      return "/studio";
  }
}
