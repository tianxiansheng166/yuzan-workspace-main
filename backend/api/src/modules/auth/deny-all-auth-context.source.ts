import type { ExecutionContext } from "@nestjs/common";
import type {
  AuthContext,
  AuthContextSource,
} from "../../common/security/index.js";

/**
 * Fail-closed authentication context source.
 *
 * This is the production default registered by AuthModule. It never resolves
 * an authenticated principal, so every protected route returns 401 unless a
 * future module overrides AUTH_CONTEXT_SOURCE with a real session/token adapter.
 *
 * StubAuthContextSource is kept for explicit test overrides only and must not
 * be used as the default source.
 */
export class DenyAllAuthContextSource implements AuthContextSource {
  resolve(_context: ExecutionContext): AuthContext | null {
    return null;
  }
}
