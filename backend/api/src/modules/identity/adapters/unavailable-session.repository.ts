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
  create(): Promise<UserSession> {
    return Promise.reject(new IdentityException("AUTH_SERVICE_UNAVAILABLE"));
  }

  findByAccessTokenHash(): Promise<UserSession | null> {
    return Promise.reject(new IdentityException("AUTH_SERVICE_UNAVAILABLE"));
  }

  findByRefreshTokenHash(): Promise<UserSession | null> {
    return Promise.reject(new IdentityException("AUTH_SERVICE_UNAVAILABLE"));
  }

  revoke(): Promise<void> {
    return Promise.reject(new IdentityException("AUTH_SERVICE_UNAVAILABLE"));
  }

  compareAndRotateRefreshSession(): Promise<UserSession | null> {
    return Promise.reject(new IdentityException("AUTH_SERVICE_UNAVAILABLE"));
  }
}
