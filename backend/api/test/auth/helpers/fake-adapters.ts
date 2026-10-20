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

  findByIdentifier(identifier: string): Promise<UserIdentity | null> {
    return Promise.resolve(this.users.get(identifier) ?? null);
  }

  findById(userId: string): Promise<UserIdentity | null> {
    return Promise.resolve(this.users.get(userId) ?? null);
  }
}

export class FakeMembershipRepository implements MembershipRepository {
  private memberships: UserMembership[] = [];

  add(...memberships: UserMembership[]): void {
    this.memberships.push(...memberships);
  }

  findActiveMembershipsByUser(
    userId: string,
  ): Promise<readonly UserMembership[]> {
    return Promise.resolve(this.memberships.filter((m) => m.userId === userId));
  }

  findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<UserMembership | null> {
    return Promise.resolve(
      this.memberships.find(
        (m) => m.userId === userId && m.schoolId === schoolId,
      ) ?? null,
    );
  }
}

export class FakePasswordVerifier implements PasswordVerifier {
  private passwords = new Map<string, string>();
  readonly calls: Array<{ kind: "real" | "dummy"; password: string }> = [];

  register(userId: string, password: string): void {
    this.passwords.set(userId, password);
  }

  verify(password: string, hash: string): Promise<boolean> {
    this.calls.push({ kind: "real", password });
    // In tests, the "hash" is the userId placeholder recorded by fixtures.
    const expected = this.passwords.get(hash);
    return Promise.resolve(expected === password);
  }

  verifyDummy(password: string): Promise<boolean> {
    this.calls.push({ kind: "dummy", password });
    return Promise.resolve(false);
  }
}

export class FakeSessionTokenService implements SessionTokenService {
  private counter = 0;

  generatePair(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    this.counter += 1;
    const accessToken = `access-token-${this.counter}-${randomBytes(8).toString("hex")}`;
    const refreshToken = `refresh-token-${this.counter}-${randomBytes(8).toString("hex")}`;
    return Promise.resolve({ accessToken, refreshToken });
  }

  hash(token: string): Promise<string> {
    return Promise.resolve(createHash("sha256").update(token).digest("hex"));
  }
}

export class FakeSessionRepository implements SessionRepository {
  private sessionsById = new Map<string, UserSession>();
  private accessIndex = new Map<string, string>();
  private refreshIndex = new Map<string, string>();
  private nextId = 1;
  private failNextRotation = false;

  create(
    params: Readonly<{
      userId: string;
      activeSchoolId: string | null;
      accessTokenHash: string;
      refreshTokenHash: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
    }>,
  ): Promise<UserSession> {
    const session: UserSession = {
      id: `session-${this.nextId++}`,
      ...params,
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };
    this.store(session);
    return Promise.resolve(session);
  }

  findByAccessTokenHash(
    accessTokenHash: string,
  ): Promise<UserSession | null> {
    const id = this.accessIndex.get(accessTokenHash);
    return Promise.resolve(id ? (this.sessionsById.get(id) ?? null) : null);
  }

  findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<UserSession | null> {
    const id = this.refreshIndex.get(refreshTokenHash);
    return Promise.resolve(id ? (this.sessionsById.get(id) ?? null) : null);
  }

  revoke(sessionId: string): Promise<void> {
    const session = this.sessionsById.get(sessionId);
    if (session) {
      session.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  compareAndRotateRefreshSession(
    params: Readonly<{
      sessionId: string;
      expectedRefreshTokenHash: string;
      now: Date;
      successor: {
        activeSchoolId: string | null;
        accessTokenHash: string;
        refreshTokenHash: string;
        accessExpiresAt: Date;
        refreshExpiresAt: Date;
      };
    }>,
  ): Promise<UserSession | null> {
    const session = this.sessionsById.get(params.sessionId);
    if (
      this.failNextRotation ||
      !session ||
      session.revokedAt ||
      session.refreshTokenHash !== params.expectedRefreshTokenHash ||
      session.refreshExpiresAt <= params.now
    ) {
      this.failNextRotation = false;
      return Promise.resolve(null);
    }
    session.revokedAt = params.now;
    const successor: UserSession = {
      id: `session-${this.nextId++}`,
      userId: session.userId,
      ...params.successor,
      revokedAt: null,
      createdAt: params.now,
      lastUsedAt: params.now,
    };
    this.store(successor);
    return Promise.resolve(successor);
  }

  sessionCount(): number {
    return this.sessionsById.size;
  }

  activeSessionCount(): number {
    return [...this.sessionsById.values()].filter(
      (session) => !session.revokedAt,
    ).length;
  }

  failNextCompareAndRotate(): void {
    this.failNextRotation = true;
  }

  private store(session: UserSession): void {
    this.sessionsById.set(session.id, session);
    this.accessIndex.set(session.accessTokenHash, session.id);
    this.refreshIndex.set(session.refreshTokenHash, session.id);
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
