import { Inject, Injectable } from "@nestjs/common";
import {
  createAuthContext,
  isMembershipRole,
  MembershipRole,
  MembershipStatus,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import {
  CLOCK,
  MEMBERSHIP_REPOSITORY,
  PASSWORD_VERIFIER,
  SESSION_REPOSITORY,
  SESSION_TOKEN_SERVICE,
  USER_IDENTITY_REPOSITORY,
  type Clock,
  type MembershipRepository,
  type PasswordVerifier,
  type SessionRepository,
  type SessionTokenService,
  type UserIdentityRepository,
} from "./ports/index.js";
import { IdentityException } from "./identity.errors.js";
import type {
  CurrentUser,
  IdentitySession,
  TokenPair,
  UserIdentity,
  UserMembership,
} from "./identity.types.js";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class IdentityService {
  constructor(
    @Inject(USER_IDENTITY_REPOSITORY)
    private readonly users: UserIdentityRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly memberships: MembershipRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
    @Inject(SESSION_TOKEN_SERVICE)
    private readonly tokens: SessionTokenService,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async login(identifier: string, password: string): Promise<IdentitySession> {
    const user = await this.users.findByIdentifier(identifier);
    const passwordValid = user
      ? await this.passwordVerifier.verify(password, user.passwordHash)
      : false;

    // Uniform failure response to prevent account enumeration.
    if (!user || !passwordValid || user.status !== "ACTIVE") {
      throw new IdentityException("AUTH_INVALID_CREDENTIALS");
    }

    const memberships = await this.memberships.findActiveMembershipsByUser(
      user.id,
    );
    const activeMemberships = memberships.filter(
      (m) => m.status === MembershipStatus.ACTIVE,
    );

    if (activeMemberships.length === 0) {
      throw new IdentityException("AUTH_MEMBERSHIP_INACTIVE");
    }

    this.rejectUnsupportedRoles(activeMemberships);

    const activeSchoolId = this.resolveActiveSchoolId(activeMemberships);
    const session = await this.createSession(user.id, activeSchoolId);

    return {
      user,
      memberships: activeMemberships,
      activeSchoolId,
      tokens: session,
    };
  }

  async refresh(refreshToken: string): Promise<IdentitySession> {
    const refreshHash = await this.tokens.hash(refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(refreshHash);

    if (!session) {
      throw new IdentityException("AUTH_INVALID_CREDENTIALS");
    }

    if (session.revokedAt) {
      throw new IdentityException("AUTH_SESSION_REVOKED");
    }

    if (session.expiresAt <= this.clock.now()) {
      throw new IdentityException("AUTH_SESSION_EXPIRED");
    }

    const user = await this.users.findById(session.userId);
    if (!user || user.status !== "ACTIVE") {
      throw new IdentityException("AUTH_INVALID_CREDENTIALS");
    }

    const memberships = await this.memberships.findActiveMembershipsByUser(
      user.id,
    );
    const activeMemberships = memberships.filter(
      (m) => m.status === MembershipStatus.ACTIVE,
    );

    if (activeMemberships.length === 0) {
      throw new IdentityException("AUTH_MEMBERSHIP_INACTIVE");
    }

    this.rejectUnsupportedRoles(activeMemberships);

    const targetMembership = session.activeSchoolId
      ? activeMemberships.find((m) => m.schoolId === session.activeSchoolId)
      : activeMemberships[0];

    if (!targetMembership) {
      throw new IdentityException("AUTH_TENANT_NOT_ALLOWED");
    }

    const activeSchoolId = targetMembership.schoolId;

    const newTokens = await this.tokens.generatePair();
    const newAccessHash = await this.tokens.hash(newTokens.accessToken);
    const newRefreshHash = await this.tokens.hash(newTokens.refreshToken);
    const newExpiresAt = this.expiresAt();

    const rotated = await this.sessions.rotateRefreshToken(
      session.id,
      newRefreshHash,
      newExpiresAt,
    );

    if (!rotated) {
      throw new IdentityException("AUTH_SESSION_REVOKED");
    }

    // Store the access token hash so the session-aware AuthContextSource can
    // resolve requests without exposing the raw token.
    await this.sessions.create({
      userId: user.id,
      activeSchoolId,
      accessTokenHash: newAccessHash,
      refreshTokenHash: newRefreshHash,
      expiresAt: newExpiresAt,
    });

    return {
      user,
      memberships: activeMemberships,
      activeSchoolId,
      tokens: newTokens,
    };
  }

  async logout(accessToken: string): Promise<void> {
    const accessHash = await this.tokens.hash(accessToken);
    const session = await this.sessions.findByAccessTokenHash(accessHash);

    if (!session) {
      // Treat missing session as already logged out.
      return;
    }

    await this.sessions.revoke(session.id);
  }

  async getCurrentUser(
    userId: string,
  ): Promise<{ user: UserIdentity; memberships: readonly UserMembership[] }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new IdentityException("AUTH_INVALID_CREDENTIALS");
    }

    const memberships =
      await this.memberships.findActiveMembershipsByUser(userId);
    const activeMemberships = memberships.filter(
      (m) => m.status === MembershipStatus.ACTIVE,
    );

    return { user, memberships: activeMemberships };
  }

  /**
   * Select an active school for a user that has multiple memberships.
   *
   * This is an internal service boundary. The OpenAPI contract does not expose
   * a dedicated school-selection endpoint, so this method is provided for a
   * future controller or for callers that need to establish an explicit tenant
   * context after login.
   */
  async selectActiveSchool(
    userId: string,
    schoolId: string,
  ): Promise<IdentitySession> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== "ACTIVE") {
      throw new IdentityException("AUTH_INVALID_CREDENTIALS");
    }

    const membership = await this.memberships.findByUserAndSchool(
      userId,
      schoolId,
    );
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new IdentityException("AUTH_TENANT_NOT_ALLOWED");
    }

    if (!isMembershipRole(membership.role)) {
      throw new IdentityException("AUTH_ROLE_UNSUPPORTED");
    }

    const memberships =
      await this.memberships.findActiveMembershipsByUser(userId);
    const activeMemberships = memberships.filter(
      (m) => m.status === MembershipStatus.ACTIVE,
    );

    const session = await this.createSession(user.id, schoolId);

    return {
      user,
      memberships: activeMemberships,
      activeSchoolId: schoolId,
      tokens: session,
    };
  }

  /**
   * Resolve an authenticated session into the GOV-006 AuthContext.
   *
   * This is the boundary used by the session-aware AuthContextSource.
   */
  async resolveSession(
    requestId: string,
    accessToken: string,
  ): Promise<ReturnType<typeof createAuthContext> | null> {
    const accessHash = await this.tokens.hash(accessToken);
    const session = await this.sessions.findByAccessTokenHash(accessHash);

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= this.clock.now()
    ) {
      return null;
    }

    const user = await this.users.findById(session.userId);
    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    const memberships = await this.memberships.findActiveMembershipsByUser(
      user.id,
    );
    const activeMemberships = memberships.filter(
      (m) => m.status === MembershipStatus.ACTIVE,
    );

    if (activeMemberships.length === 0) {
      return null;
    }

    const targetMembership = session.activeSchoolId
      ? activeMemberships.find((m) => m.schoolId === session.activeSchoolId)
      : activeMemberships[0];

    if (!targetMembership || !isMembershipRole(targetMembership.role)) {
      return null;
    }

    const principal: Principal = {
      userId: user.id,
      roles: [targetMembership.role],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "session",
    };

    const tenant: TenantContext = { schoolId: targetMembership.schoolId };
    return createAuthContext(requestId, principal, tenant);
  }

  toCurrentUser(
    user: UserIdentity,
    memberships: readonly UserMembership[],
  ): CurrentUser {
    return {
      id: user.id,
      displayName: user.displayName,
      preferredLocale: user.preferredLocale,
      memberships: memberships.map((m) => ({
        schoolId: m.schoolId,
        schoolName: m.schoolName,
        role: m.role,
      })),
    };
  }

  private async createSession(
    userId: string,
    activeSchoolId: string | null,
  ): Promise<TokenPair> {
    const tokens = await this.tokens.generatePair();
    const accessHash = await this.tokens.hash(tokens.accessToken);
    const refreshHash = await this.tokens.hash(tokens.refreshToken);
    const expiresAt = this.expiresAt();

    await this.sessions.create({
      userId,
      activeSchoolId,
      accessTokenHash: accessHash,
      refreshTokenHash: refreshHash,
      expiresAt,
    });

    return tokens;
  }

  private expiresAt(): Date {
    return new Date(this.clock.now().getTime() + REFRESH_TOKEN_TTL_MS);
  }

  private resolveActiveSchoolId(
    memberships: readonly UserMembership[],
  ): string | null {
    if (memberships.length === 0) {
      return null;
    }
    // If the user has only one active membership, default to it.
    // Multiple memberships require an explicit selection step.
    return memberships.length === 1 ? memberships[0]!.schoolId : null;
  }

  private rejectUnsupportedRoles(memberships: readonly UserMembership[]): void {
    for (const membership of memberships) {
      if (!isMembershipRole(membership.role)) {
        throw new IdentityException("AUTH_ROLE_UNSUPPORTED");
      }
    }
  }
}
