import { beforeEach, describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import { SetMetadata } from "@nestjs/common";
import {
  AuthenticationGuard,
  IS_PUBLIC_KEY,
  MembershipRole,
  SecurityException,
  TenantAuthorizationGuard,
} from "../../apps/api/src/common/security/index.js";
import { StubAuthContextSource } from "../../apps/api/src/modules/auth/stub-auth-context.source.js";
import { createMockExecutionContext } from "./mock-context.js";

describe("TenantAuthorizationGuard", () => {
  let authGuard: AuthenticationGuard;
  let tenantGuard: TenantAuthorizationGuard;

  beforeEach(() => {
    authGuard = new AuthenticationGuard(
      new Reflector(),
      new StubAuthContextSource(),
    );
    tenantGuard = new TenantAuthorizationGuard(new Reflector());
  });

  it("allows public routes without tenant context", () => {
    const publicHandler = () => undefined;
    SetMetadata(IS_PUBLIC_KEY, true)(publicHandler);
    const context = createMockExecutionContext({ handler: publicHandler });
    expect(tenantGuard.canActivate(context)).toBe(true);
  });

  it("rejects cross-school access", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "teacher-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": MembershipRole.TEACHER,
      },
      params: { schoolId: "school-b" },
    });
    await authGuard.canActivate(context);
    expect(() => tenantGuard.canActivate(context)).toThrow(SecurityException);
  });

  it("rejects teacher accessing another school", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "teacher-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": MembershipRole.TEACHER,
      },
      params: { schoolId: "school-b" },
    });
    await authGuard.canActivate(context);
    expect(() => tenantGuard.canActivate(context)).toThrow(SecurityException);
  });

  it("rejects school admin accessing other tenant", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "admin-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": MembershipRole.SCHOOL_ADMIN,
      },
      params: { schoolId: "school-b" },
    });
    await authGuard.canActivate(context);
    expect(() => tenantGuard.canActivate(context)).toThrow(SecurityException);
  });

  it("allows access within the same tenant", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "teacher-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": MembershipRole.TEACHER,
      },
      params: { schoolId: "school-a" },
    });
    await authGuard.canActivate(context);
    expect(tenantGuard.canActivate(context)).toBe(true);
  });

  it("rejects missing tenant context", async () => {
    const context = createMockExecutionContext({
      params: { schoolId: "school-a" },
    });
    expect(() => tenantGuard.canActivate(context)).toThrow(SecurityException);
  });
});
