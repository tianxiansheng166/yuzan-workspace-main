import { beforeEach, describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import {
  AuthenticationGuard,
  MembershipRole,
  Public,
  SecurityException,
} from "../../apps/api/src/common/security/index.js";
import { StubAuthContextSource } from "../../apps/api/src/modules/auth/stub-auth-context.source.js";
import { createMockExecutionContext } from "./mock-context.js";

describe("AuthenticationGuard", () => {
  let guard: AuthenticationGuard;

  beforeEach(() => {
    guard = new AuthenticationGuard(
      new Reflector(),
      new StubAuthContextSource(),
    );
  });

  it("rejects unauthenticated requests", async () => {
    const context = createMockExecutionContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
  });

  it("rejects requests with unknown roles", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "user-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": "SUPER_HACKER",
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
  });

  it("rejects RESEARCHER as an unknown role", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "researcher-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": "RESEARCHER",
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
    await expect(guard.canActivate(context)).rejects.toHaveProperty(
      "code",
      "UNKNOWN_ROLE",
    );
  });

  it("rejects requests with missing tenant", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "user-1",
        "x-stub-roles": MembershipRole.STUDENT,
      },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      SecurityException,
    );
  });

  it("allows public routes without authentication", async () => {
    const reflector = new Reflector();
    const publicHandler = () => undefined;
    Public()(publicHandler);
    const publicGuard = new AuthenticationGuard(
      reflector,
      new StubAuthContextSource(),
    );
    const context = createMockExecutionContext({ handler: publicHandler });
    await expect(publicGuard.canActivate(context)).resolves.toBe(true);
  });

  it("allows authenticated active student", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "student-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": MembershipRole.STUDENT,
      },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("attaches principal and tenant to request", async () => {
    const context = createMockExecutionContext({
      headers: {
        "x-stub-user-id": "student-1",
        "x-stub-school-id": "school-a",
        "x-stub-roles": MembershipRole.STUDENT,
      },
    });
    await guard.canActivate(context);
    const request = context.switchToHttp().getRequest();
    expect(request.principal.userId).toBe("student-1");
    expect(request.tenant.schoolId).toBe("school-a");
  });
});
