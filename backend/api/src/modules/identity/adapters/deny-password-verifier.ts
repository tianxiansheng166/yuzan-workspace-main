import type { PasswordVerifier } from "../ports/index.js";

/**
 * Fail-closed password verifier.
 *
 * The default production adapter never accepts a password. A real verifier
 * must only be wired once a supported password-hashing library is confirmed.
 */
export class DenyPasswordVerifier implements PasswordVerifier {
  verify(_password: string, _hash: string): Promise<boolean> {
    void _password;
    void _hash;
    return Promise.resolve(false);
  }

  verifyDummy(_password: string): Promise<boolean> {
    void _password;
    return Promise.resolve(false);
  }

  hash(_password: string): Promise<string> {
    void _password;
    return Promise.reject(
      new Error("Password hashing is not available in deny-all mode"),
    );
  }
}
