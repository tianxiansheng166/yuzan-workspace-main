import { Inject, Injectable } from "@nestjs/common";
import {
  createAuthContext,
  isMembershipRole,
  MembershipRole,
  MembershipStatus,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { Prisma } from "@yuzan/database";
import { PrismaService } from "../../shared/database/prisma.service.js";
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

const DEFAULT_SCHOOL_CODE = "default-school";

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
    private readonly prisma: PrismaService,
  ) {}

  async login(identifier: string, password: string): Promise<IdentitySession> {
    const normalizedIdentifier = identifier.trim();
    const user = await this.users.findByIdentifier(normalizedIdentifier);
    const passwordValid = user
      ? await this.passwordVerifier.verify(password, user.passwordHash)
      : await this.passwordVerifier.verifyDummy(password);

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

    const now = this.clock.now();
    if (session.refreshExpiresAt <= now) {
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

    const activeSchoolId = this.resolveSessionSchoolId(
      session.activeSchoolId,
      activeMemberships,
    );
    if (session.activeSchoolId && !activeSchoolId) {
      throw new IdentityException("AUTH_TENANT_NOT_ALLOWED");
    }

    const newTokens = await this.generateTokens(now);
    const newAccessHash = await this.tokens.hash(newTokens.accessToken);
    const newRefreshHash = await this.tokens.hash(newTokens.refreshToken);

    const rotated = await this.sessions.compareAndRotateRefreshSession({
      sessionId: session.id,
      expectedRefreshTokenHash: refreshHash,
      now,
      successor: {
        activeSchoolId,
        accessTokenHash: newAccessHash,
        refreshTokenHash: newRefreshHash,
        accessExpiresAt: newTokens.accessExpiresAt,
        refreshExpiresAt: newTokens.refreshExpiresAt,
      },
    });

    if (!rotated) {
      throw new IdentityException("AUTH_SESSION_REVOKED");
    }

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
   * This is the service boundary backing the formal `/auth/select-school`
   * endpoint declared in the OpenAPI contract. Callers must present a valid
   * access token; the existing session is revoked and a fresh token pair bound
   * to the chosen school is returned.
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

  async selectActiveSchoolWithAccessToken(
    accessToken: string,
    schoolId: string,
  ): Promise<IdentitySession> {
    const accessHash = await this.tokens.hash(accessToken);
    const current = await this.sessions.findByAccessTokenHash(accessHash);
    if (
      !current ||
      current.revokedAt ||
      current.accessExpiresAt <= this.clock.now()
    ) {
      throw new IdentityException("AUTH_SESSION_EXPIRED");
    }

    const selected = await this.selectActiveSchool(current.userId, schoolId);
    await this.sessions.revoke(current.id);
    return selected;
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
      session.accessExpiresAt <= this.clock.now()
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

    const activeSchoolId = this.resolveSessionSchoolId(
      session.activeSchoolId,
      activeMemberships,
    );
    if (!activeSchoolId) {
      return null;
    }
    const targetMembership = activeMemberships.find(
      (membership) => membership.schoolId === activeSchoolId,
    );

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
    const tokens = await this.generateTokens(this.clock.now());
    const accessHash = await this.tokens.hash(tokens.accessToken);
    const refreshHash = await this.tokens.hash(tokens.refreshToken);

    await this.sessions.create({
      userId,
      activeSchoolId,
      accessTokenHash: accessHash,
      refreshTokenHash: refreshHash,
      accessExpiresAt: tokens.accessExpiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
    });

    return tokens;
  }

  private async generateTokens(now: Date): Promise<TokenPair> {
    const generated = await this.tokens.generatePair();
    return {
      accessToken: generated.accessToken,
      refreshToken: generated.refreshToken,
      accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    };
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

  private resolveSessionSchoolId(
    activeSchoolId: string | null,
    activeMemberships: readonly UserMembership[],
  ): string | null {
    if (activeSchoolId) {
      return activeMemberships.some(
        (membership) => membership.schoolId === activeSchoolId,
      )
        ? activeSchoolId
        : null;
    }
    return activeMemberships.length === 1
      ? activeMemberships[0]!.schoolId
      : null;
  }

  private rejectUnsupportedRoles(memberships: readonly UserMembership[]): void {
    for (const membership of memberships) {
      if (!isMembershipRole(membership.role)) {
        throw new IdentityException("AUTH_ROLE_UNSUPPORTED");
      }
    }
  }

  /**
   * Register a new user with phone number, password, and role.
   *
   * Creates: User → default School (if not exists) → Membership → Session.
   * Returns the same structure as login (auto-login after registration).
   */
  async register(
    identifier: string,
    password: string,
    role: MembershipRole,
  ): Promise<IdentitySession> {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) {
      throw new IdentityException("AUTH_INVALID_CREDENTIALS");
    }

    // 1. Check if identifier already exists
    const existing = await this.users.findByIdentifier(normalizedIdentifier);
    if (existing) {
      throw new IdentityException("AUTH_IDENTIFIER_CONFLICT");
    }

    // 2. Validate role
    if (!isMembershipRole(role)) {
      throw new IdentityException("AUTH_ROLE_UNSUPPORTED");
    }

    // 3. Hash the password
    const passwordHash = await this.passwordVerifier.hash(password);

    // 4. Find or create the default school
    let school = await this.prisma.school.findUnique({
      where: { code: DEFAULT_SCHOOL_CODE },
    });
    if (!school) {
      school = await this.prisma.school.create({
        data: {
          code: DEFAULT_SCHOOL_CODE,
          name: "默认学校",
          timezone: "Asia/Shanghai",
          isActive: true,
        },
      });
    }

    // 5. Create User + Membership in a transaction
    const createdUser = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          loginIdentifier: normalizedIdentifier,
          displayName: normalizedIdentifier,
          passwordHash,
          status: "ACTIVE",
          preferredLocale: "zh-CN",
        },
      });

      await tx.membership.create({
        data: {
          schoolId: school!.id,
          userId: user.id,
          role,
          status: "ACTIVE",
        },
      });

      return user;
    });

    // 6. Reload user and memberships through the repository
    const user = await this.users.findById(createdUser.id);
    if (!user) {
      throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
    }

    const allMemberships =
      await this.memberships.findActiveMembershipsByUser(user.id);
    const activeMemberships = allMemberships.filter(
      (m) => m.status === MembershipStatus.ACTIVE,
    );

    const activeSchoolId = this.resolveActiveSchoolId(activeMemberships);
    const session = await this.createSession(user.id, activeSchoolId);

    return {
      user,
      memberships: activeMemberships,
      activeSchoolId,
      tokens: session,
    };
  }
}
