import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type {
  AuthContext,
  AuthContextSource,
  Principal,
  TenantContext,
} from "../../common/security/index.js";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";

/**
 * Demo/test authentication context source.
 *
 * This adapter is intentionally minimal and insecure. It reads synthetic
 * identity headers so that GOV-006 security tests can run without a real
 * login service. IDN-001 will replace this with session/token resolution.
 *
 * Production code must never trust client-provided roles.
 */
export class StubAuthContextSource implements AuthContextSource {
  resolve(context: ExecutionContext): AuthContext | null {
    const request = context.switchToHttp().getRequest<Request>();
    const headers = request.headers as Record<string, string | undefined>;

    const userId = headers["x-stub-user-id"];
    const schoolId = headers["x-stub-school-id"];
    const roleHeader = headers["x-stub-roles"];

    if (!userId || !schoolId || !roleHeader) {
      return null;
    }

    const roles = roleHeader
      .split(",")
      .map((role) => role.trim())
      .filter((role): role is MembershipRole =>
        Object.values(MembershipRole).includes(role as MembershipRole),
      );

    if (roles.length === 0) {
      // Return a principal with unknown roles so AuthenticationGuard can
      // produce the UNKNOWN_ROLE denial.
      const unknownPrincipal: Principal = {
        userId,
        roles: roleHeader
          .split(",")
          .map((role) => role.trim() as MembershipRole),
        membershipStatus: MembershipStatus.ACTIVE,
        source: "stub",
      };
      const tenant: TenantContext = { schoolId };
      return createAuthContext("stub-request", unknownPrincipal, tenant);
    }

    const principal: Principal = {
      userId,
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "stub",
    };

    const tenant: TenantContext = { schoolId };
    return createAuthContext("stub-request", principal, tenant);
  }
}
