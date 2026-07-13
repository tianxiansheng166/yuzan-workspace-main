import {
  defaultRouteForMembershipRole,
  findProductRoute,
} from "../routing/product-route-registry";
import type { MembershipRole } from "../lib/api/types";

export default defineNuxtRouteMiddleware(async (to) => {
  const registration = findProductRoute(to.path);
  if (!registration) return;

  if (registration.developmentOnly && !import.meta.dev) {
    return navigateTo(registration.fallbackRoute, { replace: true });
  }

  const requiresAuthentication =
    registration.requiresAuthentication === true ||
    registration.port !== "PUBLIC";
  if (!requiresAuthentication) return;

  const session = useProductSession();
  await session.refresh();
  if (session.state.value.status !== "authenticated") {
    return navigateTo(
      { path: "/login", query: { redirect: to.fullPath } },
      { replace: true },
    );
  }

  if (!registration.requiresSchool) return;
  const membership = session.activeMembership.value;
  if (!membership) {
    return navigateTo(
      { path: "/select-school", query: { reason: "school-required" } },
      { replace: true },
    );
  }

  if (
    !(registration.roles as readonly MembershipRole[]).includes(membership.role)
  ) {
    const fallback = defaultRouteForMembershipRole(membership.role);
    return navigateTo(
      {
        path: fallback,
        query: { accessReason: "role-mismatch", deniedRoute: to.path },
      },
      { replace: true },
    );
  }
});
