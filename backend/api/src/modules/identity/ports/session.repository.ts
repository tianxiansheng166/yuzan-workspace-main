import type { UserSession } from "../identity.types.js";

/**
 * Port for secure session persistence.
 *
 * The repository stores token hashes, not raw tokens. It supports expiry,
 * revocation, and refresh-token rotation. Production default is unavailable
 * until a real persistence layer is wired.
 */
export interface SessionRepository {
  create(
    params: Readonly<{
      userId: string;
      activeSchoolId: string | null;
      accessTokenHash: string;
      refreshTokenHash: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
    }>,
  ): Promise<UserSession>;

  findByAccessTokenHash(accessTokenHash: string): Promise<UserSession | null>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<UserSession | null>;

  revoke(sessionId: string): Promise<void>;

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
  ): Promise<UserSession | null>;
}

export const SESSION_REPOSITORY = Symbol("SESSION_REPOSITORY");
