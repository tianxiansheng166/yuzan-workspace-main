import { describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import { SetMetadata } from "@nestjs/common";
import {
  type AuthContext,
  MembershipRole,
  MembershipStatus,
  Permission,
  PolicyGuard,
  Public,
  RequirePermissions,
  RequireRoles,
  RESOURCE_POLICY_KEY,
  SecurityException,
} from "../../backend/api/src/common/security/index.js";
import { createMockExecutionContext } from "./mock-context.js";

function makeAuthContext(roles: readonly MembershipRole[]): AuthContext {
  return {
    requestId: "req-1",
    principal: {
      userId: "user-1",
      roles,
      membershipStatus: MembershipStatus.ACTIVE,
      source: "stub",
    },
    tenant: { schoolId: "school-a" },
  };
}

describe("PolicyGuard", () => {
  it("allows public routes without authentication", async () => {
    const publicHandler = () => undefined;
    Public()(publicHandler);
    const guard = new PolicyGuard(new Reflector());
    const context = createMockExecutionContext({ handler: publicHandler });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("allows requests that have no role/permission/policy metadata", async () => {
    const guard = new PolicyGuard(new Reflector());
    const context = createMockExecutionContext({ handler: () => undefined });
    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.STUDENT,
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects requests without an authContext", async () => {
    const guard = new PolicyGuard(new Reflector());
    const context = createMockExecutionContext({ handler: () => undefined });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
  });

  it("enforces required roles", async () => {
    const handler = () => undefined;
    RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)(handler);
    const guard = new PolicyGuard(new Reflector());
    const context = createMockExecutionContext({ handler });

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.STUDENT,
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.TEACHER,
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.SCHOOL_ADMIN,
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("enforces required permissions", async () => {
    const handler = () => undefined;
    RequirePermissions(Permission.ASSIGNMENT_SUBMIT)(handler);
    const guard = new PolicyGuard(new Reflector());
    const context = createMockExecutionContext({ handler });

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.TEACHER,
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.STUDENT,
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("enforces platform admin boundaries", async () => {
    const handler = () => undefined;
    RequireRoles(MembershipRole.PLATFORM_ADMIN)(handler);
    const guard = new PolicyGuard(new Reflector());
    const context = createMockExecutionContext({ handler });

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.SCHOOL_ADMIN,
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );

    context.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.PLATFORM_ADMIN,
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("enforces resource policies", async () => {
    const deniedHandler = () => undefined;
    SetMetadata(RESOURCE_POLICY_KEY, { authorize: () => false })(deniedHandler);
    const deniedGuard = new PolicyGuard(new Reflector());
    const deniedContext = createMockExecutionContext({
      handler: deniedHandler,
    });
    deniedContext.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.TEACHER,
    ]);
    await expect(deniedGuard.canActivate(deniedContext)).rejects.toBeInstanceOf(
      SecurityException,
    );

    const allowedHandler = () => undefined;
    SetMetadata(RESOURCE_POLICY_KEY, { authorize: () => true })(allowedHandler);
    const allowedGuard = new PolicyGuard(new Reflector());
    const allowedContext = createMockExecutionContext({
      handler: allowedHandler,
    });
    allowedContext.switchToHttp().getRequest().authContext = makeAuthContext([
      MembershipRole.TEACHER,
    ]);
    await expect(allowedGuard.canActivate(allowedContext)).resolves.toBe(true);
  });
});
