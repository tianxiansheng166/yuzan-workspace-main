import type { UserRole } from "../models";
import { defaultRouteForRole } from "./roles";
import { roleCanAccessRoute } from "../../../routing/product-route-registry";
import type { MembershipRole } from "../../../lib/api/types";

export function firstQueryValue(
  value: string | null | (string | null)[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

export function sanitizeInternalRedirect(
  input: string | undefined,
): string | undefined {
  if (!input) {
    return undefined;
  }

  const value = input.trim();

  if (!value.startsWith("/")) {
    return undefined;
  }

  if (value.startsWith("//")) {
    return undefined;
  }

  const lowerCaseValue = value.toLowerCase();

  if (
    lowerCaseValue.startsWith("/http:") ||
    lowerCaseValue.startsWith("/https:") ||
    lowerCaseValue.startsWith("/javascript:")
  ) {
    return undefined;
  }

  return value;
}

export function resolvePostLoginRedirect(
  role: UserRole,
  redirectTo: string | undefined,
): string {
  const safe = sanitizeInternalRedirect(redirectTo);
  const membershipRole = membershipRoleForUserRole(role);
  return safe && membershipRole && roleCanAccessRoute(membershipRole, safe)
    ? safe
    : defaultRouteForRole(role);
}

function membershipRoleForUserRole(role: UserRole): MembershipRole | undefined {
  return {
    student: "STUDENT",
    teacher: "TEACHER",
    volunteer: "VOLUNTEER",
    researcher: "RESEARCHER",
    admin: "SCHOOL_ADMIN",
    unassigned: undefined,
  }[role] as MembershipRole | undefined;
}
