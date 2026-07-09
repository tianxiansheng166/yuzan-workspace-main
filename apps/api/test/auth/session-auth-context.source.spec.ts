import { describe, expect, it } from "vitest";
import { SessionAuthContextSource } from "../../src/modules/auth/session-auth-context.source.js";
import { MembershipRole } from "../../src/common/security/index.js";
import { createIdentityServiceFixture } from "./helpers/create-identity-service.js";
import { createMockExecutionContext } from "./helpers/mock-execution-context.js";
import { activeTeacher, teacherMembership } from "./fixtures/users.js";

describe("SessionAuthContextSource", () => {
  it("resolves an AuthContext from an Authorization Bearer token", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));

    const session = await f.service.login(user.loginIdentifier, "password");
    const source = new SessionAuthContextSource(f.service);
    const context = createMockExecutionContext({
      headers: {
        authorization: `Bearer ${session.tokens.accessToken}`,
      },
    });

    const result = await source.resolve(context);

    expect(result).not.toBeNull();
    expect(result!.principal.userId).toBe(user.id);
    expect(result!.principal.roles).toContain(MembershipRole.TEACHER);
    expect(result!.tenant.schoolId).toBe("school-a");
  });

  it("resolves an AuthContext from an access_token cookie", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));

    const session = await f.service.login(user.loginIdentifier, "password");
    const source = new SessionAuthContextSource(f.service);
    const context = createMockExecutionContext({
      headers: {
        cookie: `access_token=${session.tokens.accessToken}; other=value`,
      },
    });

    const result = await source.resolve(context);

    expect(result).not.toBeNull();
    expect(result!.principal.userId).toBe(user.id);
  });

  it("returns null when no token is present", async () => {
    const f = createIdentityServiceFixture();
    const source = new SessionAuthContextSource(f.service);
    const context = createMockExecutionContext({});

    const result = await source.resolve(context);

    expect(result).toBeNull();
  });

  it("returns null for an invalid or expired token", async () => {
    const f = createIdentityServiceFixture();
    const source = new SessionAuthContextSource(f.service);
    const context = createMockExecutionContext({
      headers: {
        authorization: "Bearer not-a-real-token",
      },
    });

    const result = await source.resolve(context);

    expect(result).toBeNull();
  });

  it("ignores client-provided roles and reads roles from server membership", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));

    const session = await f.service.login(user.loginIdentifier, "password");
    const source = new SessionAuthContextSource(f.service);
    const context = createMockExecutionContext({
      headers: {
        authorization: `Bearer ${session.tokens.accessToken}`,
        "x-role": "PLATFORM_ADMIN",
      },
    });

    const result = await source.resolve(context);

    expect(result).not.toBeNull();
    expect(result!.principal.roles).toEqual([MembershipRole.TEACHER]);
  });
});
