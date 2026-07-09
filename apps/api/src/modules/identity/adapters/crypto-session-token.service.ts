import { randomBytes, createHash } from "node:crypto";
import type { SessionTokenService } from "../ports/session-token.service.js";
import type { TokenPair } from "../identity.types.js";

const TOKEN_BYTES = 48;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Cryptographically secure opaque token service.
 *
 * Uses Node.js crypto randomBytes for token generation and SHA-256 only for
 * the stored hash. SHA-256 is acceptable here because tokens are high-entropy
 * random values; the hash is used for lookup, not for password protection.
 */
export class CryptoSessionTokenService implements SessionTokenService {
  async generatePair(): Promise<TokenPair> {
    const now = Date.now();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    // Refresh token drives the session lifetime.
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    return { accessToken, refreshToken, expiresAt };
  }

  async hash(token: string): Promise<string> {
    return createHash("sha256").update(token).digest("hex");
  }
}
