import type { MembershipRole } from "./types";
import { defaultRouteForMembershipRole } from "../../routing/product-route-registry";

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
  return defaultRouteForMembershipRole(role);
}
