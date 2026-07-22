/**
 * Port for generating opaque session tokens.
 *
 * Implementations must use a cryptographically secure random source and
 * must never expose the token hash derivation algorithm.
 */
export interface SessionTokenService {
  generatePair(): Promise<{
    readonly accessToken: string;
    readonly refreshToken: string;
  }>;
  hash(token: string): Promise<string>;
}

export const SESSION_TOKEN_SERVICE = Symbol("SESSION_TOKEN_SERVICE");
