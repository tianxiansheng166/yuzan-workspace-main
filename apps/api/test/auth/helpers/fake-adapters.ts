import { createHash, randomBytes } from "node:crypto";
import type {
  Clock,
  MembershipRepository,
  PasswordVerifier,
  SessionRepository,
  SessionTokenService,
  UserIdentityRepository,
} from "../../../src/modules/identity/ports/index.js";
import type {
  TokenPair,
  UserIdentity,
  UserMembership,
  UserSession,
} from "../../../src/modules/identity/identity.types.js";

export class FakeUserIdentityRepository implements UserIdentityRepository {
  private users = new Map<string, UserIdentity>();

  add(user: UserIdentity): void {
    this.users.set(user.id, user);
    this.users.set(user.loginIdentifier, user);
  }

  async findByIdentifier(identifier: string): Promise<UserIdentity | null> {
    return this.users.get(identifier) ?? null;
  }

  async findById(userId: string): Promise<UserIdentity | null> {
    return this.users.get(userId) ?? null;
  }
}

export class FakeMembershipRepository implements MembershipRepository {
  private memberships: UserMembership[] = [];

  add(...memberships: UserMembership[]): void {
    this.memberships.push(...memberships);
  }

  async findActiveMembershipsByUser(
    userId: string,
  ): Promise<readonly UserMembership[]> {
    return this.memberships.filter((m) => m.userId === userId);
  }

  async findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<UserMembership | null> {
    return (
      this.memberships.find(
        (m) => m.userId === userId && m.schoolId === schoolId,
      ) ?? null
    );
  }
}

export class FakePasswordVerifier implements PasswordVerifier {
  private passwords = new Map<string, string>();

  register(userId: string, password: string): void {
    this.passwords.set(userId, password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    // In tests, the "hash" is the userId placeholder recorded by fixtures.
    const expected = this.passwords.get(hash);
    return expected === password;
  }
}

export class FakeSessionTokenService implements SessionTokenService {
  private counter = 0;

  async generatePair(): Promise<TokenPair> {
    this.counter += 1;
    const accessToken = `access-token-${this.counter}-${randomBytes(8).toString("hex")}`;
    const refreshToken = `refresh-token-${this.counter}-${randomBytes(8).toString("hex")}`;
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  async hash(token: string): Promise<string> {
    return createHash("sha256").update(token).digest("hex");
  }
}

export class FakeSessionRepository implements SessionRepository {
  private sessions = new Map<string, UserSession>();

  async create(
    params: Readonly<{
      userId: string;
      activeSchoolId: string | null;
      accessTokenHash: string;
      refreshTokenHash: string;
      expiresAt: Date;
    }>,
  ): Promise<UserSession> {
    const session: UserSession = {
      id: `session-${this.sessions.size + 1}`,
      ...params,
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    this.sessions.set(session.accessTokenHash, session);
    this.sessions.set(session.refreshTokenHash, session);
    return session;
  }

  async findByAccessTokenHash(
    accessTokenHash: string,
  ): Promise<UserSession | null> {
    return this.sessions.get(accessTokenHash) ?? null;
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<UserSession | null> {
    return this.sessions.get(refreshTokenHash) ?? null;
  }

  async revoke(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revokedAt = new Date();
    }
  }

  async rotateRefreshToken(
    sessionId: string,
    newRefreshHash: string,
    newExpiresAt: Date,
  ): Promise<UserSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt) {
      return null;
    }
    // Revoke the old session to prevent reuse of the old refresh token.
    session.revokedAt = new Date();
    const rotated: UserSession = {
      ...session,
      id: `session-${this.sessions.size + 1}`,
      refreshTokenHash: newRefreshHash,
      expiresAt: newExpiresAt,
      revokedAt: null,
    };
    this.sessions.set(rotated.id, rotated);
    this.sessions.set(rotated.accessTokenHash, rotated);
    this.sessions.set(rotated.refreshTokenHash, rotated);
    return rotated;
  }
}

export class FakeClock implements Clock {
  constructor(private time = new Date()) {}

  now(): Date {
    return new Date(this.time.getTime());
  }

  advance(ms: number): void {
    this.time = new Date(this.time.getTime() + ms);
  }
}
