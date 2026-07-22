import type { PasswordVerifier } from "../ports/index.js";

/**
 * Fail-closed password verifier.
 *
 * The default production adapter never accepts a password. A real verifier
 * must only be wired once a supported password-hashing library is confirmed.
 */
export class DenyPasswordVerifier implements PasswordVerifier {
  async verify(_password: string, _hash: string): Promise<boolean> {
    return false;
  }

  async verifyDummy(_password: string): Promise<boolean> {
    return false;
  }

  async hash(_password: string): Promise<string> {
    throw new Error("Password hashing is not available in deny-all mode");
  }
}
