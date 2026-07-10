import { IdentityException } from "../identity.errors.js";
import type { UserSession } from "../identity.types.js";
import type { SessionRepository } from "../ports/index.js";

/**
 * Fail-closed session repository adapter.
 *
 * Used as the production default until a real session persistence layer is
 * wired. All operations fail with AUTH_SERVICE_UNAVAILABLE.
 */
export class UnavailableSessionRepository implements SessionRepository {
  async create(): Promise<UserSession> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async findByAccessTokenHash(): Promise<UserSession | null> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async findByRefreshTokenHash(): Promise<UserSession | null> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async revoke(): Promise<void> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async compareAndRotateRefreshSession(): Promise<UserSession | null> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }
}
