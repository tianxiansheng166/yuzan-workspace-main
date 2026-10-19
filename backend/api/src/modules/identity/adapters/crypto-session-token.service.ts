import { randomBytes, createHash } from "node:crypto";
import type { SessionTokenService } from "../ports/session-token.service.js";

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
  generatePair(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return Promise.resolve().then(() => ({
      accessToken: generateToken(),
      refreshToken: generateToken(),
    }));
  }

  hash(token: string): Promise<string> {
    return Promise.resolve().then(() =>
      createHash("sha256").update(token).digest("hex"),
    );
  }
}
