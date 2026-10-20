import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../../src/common/security/auth.types.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import type { AuthContextSource } from "../../src/common/security/auth-context-source.interface.js";
import { AuthenticationGuard } from "../../src/common/security/auth.guard.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { PolicyGuard } from "../../src/common/security/policy.guard.js";
import { SecurityException } from "../../src/common/security/security-errors.js";
import { PracticeController } from "../../src/modules/assessment/practice.controller.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const teacherContext: AuthContext = {
  requestId: "test-request",
  tenant: { schoolId },
  principal: {
    userId: "22222222-2222-4222-8222-222222222222",
    roles: [MembershipRole.TEACHER],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  },
};

function attemptRequestContext(): ExecutionContext {
  const request = {
    method: "GET",
    path: `/api/v1/schools/${schoolId}/practices/attempts/33333333-3333-4333-8333-333333333333`,
    params: { schoolId, attemptId: "33333333-3333-4333-8333-333333333333" },
    headers: {},
    body: {},
  };
  const response = {
    getHeader: (name: string): string | undefined =>
      name === "x-request-id" ? "test-request" : undefined,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => () => undefined,
    getClass: () => PracticeController,
  } as unknown as ExecutionContext;
}

async function thrownSecurityStatus(
  promise: Promise<unknown>,
): Promise<number> {
  const error = await promise.catch((caught: unknown) => caught);
  if (!(error instanceof SecurityException)) {
    throw new Error(
      "Expected the practice Attempt route security guard to reject access",
    );
  }
  return error.getStatus();
}

describe("GET practice Attempt route security", () => {
  it("returns 401 when the request has no authenticated context", async () => {
    const source: AuthContextSource = { resolve: () => null };
    const status = await thrownSecurityStatus(
      new AuthenticationGuard(new Reflector(), source).canActivate(
        attemptRequestContext(),
      ),
    );

    expect(status).toBe(401);
  });

  it("returns 403 when an authenticated non-student calls the route", async () => {
    const source: AuthContextSource = { resolve: () => teacherContext };
    const context = attemptRequestContext();
    const authenticated = await new AuthenticationGuard(
      new Reflector(),
      source,
    ).canActivate(context);

    expect(authenticated).toBe(true);
    await expect(
      thrownSecurityStatus(
        new PolicyGuard(new Reflector()).canActivate(context),
      ),
    ).resolves.toBe(403);
  });
});
