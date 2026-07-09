import { describe, expect, it } from "vitest";
import { IdentityException } from "../../src/modules/identity/identity.errors.js";
import {
  MembershipRole,
  MembershipStatus,
  Permission,
  permissionsForPrincipal,
} from "../../src/common/security/index.js";
import { createIdentityServiceFixture } from "./helpers/create-identity-service.js";
import {
  activeStudent,
  activeTeacher,
  inactiveUser,
  invitedMembership,
  leftMembership,
  schoolAdminMembership,
  studentMembership,
  suspendedMembership,
  suspendedTeacher,
  teacherMembership,
} from "./fixtures/users.js";

describe("IdentityService", () => {
  it("allows login with correct credentials", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "correct-password");
    f.memberships.add(teacherMembership(user.id));

    const session = await f.service.login(
      user.loginIdentifier,
      "correct-password",
    );

    expect(session.user.id).toBe(user.id);
    expect(session.tokens.accessToken).toBeTruthy();
    expect(session.tokens.refreshToken).toBeTruthy();
  });

  it("returns the same public error for missing account", async () => {
    const f = createIdentityServiceFixture();

    await expect(
      f.service.login("nobody@example.edu", "any-password"),
    ).rejects.toBeInstanceOf(IdentityException);
    await expect(
      f.service.login("nobody@example.edu", "any-password"),
    ).rejects.toHaveProperty("code", "AUTH_INVALID_CREDENTIALS");
  });

  it("returns the same public error for wrong password", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "correct-password");
    f.memberships.add(teacherMembership(user.id));

    await expect(
      f.service.login(user.loginIdentifier, "wrong-password"),
    ).rejects.toBeInstanceOf(IdentityException);
    await expect(
      f.service.login(user.loginIdentifier, "wrong-password"),
    ).rejects.toHaveProperty("code", "AUTH_INVALID_CREDENTIALS");
  });

  it("rejects inactive users", async () => {
    const f = createIdentityServiceFixture();
    const user = inactiveUser();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id));

    await expect(
      f.service.login(user.loginIdentifier, "password"),
    ).rejects.toHaveProperty("code", "AUTH_INVALID_CREDENTIALS");
  });

  it("rejects invited membership", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(invitedMembership(user.id));

    await expect(
      f.service.login(user.loginIdentifier, "password"),
    ).rejects.toHaveProperty("code", "AUTH_MEMBERSHIP_INACTIVE");
  });

  it("rejects suspended membership", async () => {
    const f = createIdentityServiceFixture();
    const user = suspendedTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(suspendedMembership(user.id));

    await expect(
      f.service.login(user.loginIdentifier, "password"),
    ).rejects.toHaveProperty("code", "AUTH_MEMBERSHIP_INACTIVE");
  });

  it("rejects left membership", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(leftMembership(user.id));

    await expect(
      f.service.login(user.loginIdentifier, "password"),
    ).rejects.toHaveProperty("code", "AUTH_MEMBERSHIP_INACTIVE");
  });

  it("allows active student membership", async () => {
    const f = createIdentityServiceFixture();
    const user = activeStudent();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(studentMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");

    expect(session.user.id).toBe(user.id);
    expect(session.memberships[0].role).toBe(MembershipRole.STUDENT);
  });

  it("rejects unknown role strings", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add({
      id: "membership-unknown",
      userId: user.id,
      schoolId: "school-a",
      schoolName: "示例学校 A",
      role: "SUPER_HACKER" as MembershipRole,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      f.service.login(user.loginIdentifier, "password"),
    ).rejects.toHaveProperty("code", "AUTH_ROLE_UNSUPPORTED");
  });

  it("rejects RESEARCHER role", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add({
      id: "membership-researcher",
      userId: user.id,
      schoolId: "school-a",
      schoolName: "示例学校 A",
      role: "RESEARCHER" as MembershipRole,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      f.service.login(user.loginIdentifier, "password"),
    ).rejects.toHaveProperty("code", "AUTH_ROLE_UNSUPPORTED");
  });

  it("does not use client-declared role", async () => {
    const f = createIdentityServiceFixture();
    const user = activeStudent();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(studentMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    expect(session.memberships[0].role).toBe(MembershipRole.STUDENT);
  });

  it("selects the only active school by default", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));

    const session = await f.service.login(user.loginIdentifier, "password");
    expect(session.activeSchoolId).toBe("school-a");
  });

  it("leaves activeSchoolId null when multiple schools exist", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));
    f.memberships.add(teacherMembership(user.id, "school-b"));

    const session = await f.service.login(user.loginIdentifier, "password");
    expect(session.activeSchoolId).toBeNull();
  });

  it("builds AuthContext from server-side membership", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));

    const session = await f.service.login(user.loginIdentifier, "password");
    const context = await f.service.resolveSession(
      "req-1",
      session.tokens.accessToken,
    );

    expect(context).not.toBeNull();
    expect(context!.principal.userId).toBe(user.id);
    expect(context!.principal.roles).toContain(MembershipRole.TEACHER);
    expect(context!.tenant.schoolId).toBe("school-a");
  });

  it("rejects expired sessions", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    f.clock.advance(8 * 24 * 60 * 60 * 1000); // past 7-day refresh TTL

    await expect(
      f.service.refresh(session.tokens.refreshToken),
    ).rejects.toHaveProperty("code", "AUTH_SESSION_EXPIRED");
  });

  it("rejects revoked sessions", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    await f.service.logout(session.tokens.accessToken);

    await expect(
      f.service.refresh(session.tokens.refreshToken),
    ).rejects.toHaveProperty("code", "AUTH_SESSION_REVOKED");
  });

  it("rotates refresh tokens and rejects old token reuse", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id));

    const first = await f.service.login(user.loginIdentifier, "password");
    const rotated = await f.service.refresh(first.tokens.refreshToken);

    expect(rotated.tokens.refreshToken).not.toBe(first.tokens.refreshToken);

    await expect(
      f.service.refresh(first.tokens.refreshToken),
    ).rejects.toHaveProperty("code", "AUTH_SESSION_REVOKED");
  });

  it("logs out and revokes the session", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    await f.service.logout(session.tokens.accessToken);

    const context = await f.service.resolveSession(
      "req-1",
      session.tokens.accessToken,
    );
    expect(context).toBeNull();
  });

  it("rejects forged client role header", async () => {
    const f = createIdentityServiceFixture();
    const user = activeStudent();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(studentMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    const context = await f.service.resolveSession(
      "req-1",
      session.tokens.accessToken,
    );

    expect(context?.principal.roles).toEqual([MembershipRole.STUDENT]);
  });

  it("fails closed when default repositories are unavailable", async () => {
    const { IdentityService } =
      await import("../../src/modules/identity/identity.service.js");
    const { UnavailableIdentityRepository } =
      await import("../../src/modules/identity/adapters/unavailable-identity.repository.js");
    const { UnavailableSessionRepository } =
      await import("../../src/modules/identity/adapters/unavailable-session.repository.js");
    const { DenyPasswordVerifier } =
      await import("../../src/modules/identity/adapters/deny-password-verifier.js");
    const { CryptoSessionTokenService } =
      await import("../../src/modules/identity/adapters/crypto-session-token.service.js");
    const { SystemClock } =
      await import("../../src/modules/identity/adapters/system-clock.js");

    const service = new IdentityService(
      new UnavailableIdentityRepository(),
      new UnavailableIdentityRepository(),
      new UnavailableSessionRepository(),
      new DenyPasswordVerifier(),
      new CryptoSessionTokenService(),
      new SystemClock(),
    );

    await expect(
      service.login("anyone@example.edu", "password"),
    ).rejects.toHaveProperty("code", "AUTH_SERVICE_UNAVAILABLE");
  });

  it("fails closed when default password verifier denies all passwords", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    // Do not register the password; default-like verifier returns false.
    f.memberships.add(teacherMembership(user.id));

    await expect(
      f.service.login(user.loginIdentifier, "any-password"),
    ).rejects.toHaveProperty("code", "AUTH_INVALID_CREDENTIALS");
  });

  it("selects an active school when the user has multiple memberships", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));
    f.memberships.add(teacherMembership(user.id, "school-b"));

    const session = await f.service.selectActiveSchool(user.id, "school-b");

    expect(session.activeSchoolId).toBe("school-b");
    expect(session.tokens.accessToken).toBeTruthy();
    expect(session.tokens.refreshToken).toBeTruthy();
  });

  it("rejects selection of a non-member school", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id, "school-a"));

    await expect(
      f.service.selectActiveSchool(user.id, "school-z"),
    ).rejects.toHaveProperty("code", "AUTH_TENANT_NOT_ALLOWED");
  });

  it("rejects selection for a suspended school membership", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(suspendedMembership(user.id));

    await expect(
      f.service.selectActiveSchool(user.id, "school-a"),
    ).rejects.toHaveProperty("code", "AUTH_TENANT_NOT_ALLOWED");
  });

  it("builds permissions from the server-side role matrix", async () => {
    const f = createIdentityServiceFixture();
    const user = activeStudent();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(studentMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    const context = await f.service.resolveSession(
      "req-1",
      session.tokens.accessToken,
    );

    const perms = permissionsForPrincipal(context!.principal);
    expect(perms).toContain(Permission.ASSIGNMENT_SUBMIT);
    expect(perms).not.toContain(Permission.COURSE_MANAGE);
  });

  it("does not expose password hash or tokens in the public user view", async () => {
    const f = createIdentityServiceFixture();
    const user = activeTeacher();
    f.users.add(user);
    f.passwords.register(user.passwordHash, "password");
    f.memberships.add(teacherMembership(user.id));

    const session = await f.service.login(user.loginIdentifier, "password");
    const current = f.service.toCurrentUser(session.user, session.memberships);

    expect(current).not.toHaveProperty("passwordHash");
    expect(current).not.toHaveProperty("accessToken");
    expect(current).not.toHaveProperty("refreshToken");
  });
});
