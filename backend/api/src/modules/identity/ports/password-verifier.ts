/**
 * Port for password verification.
 *
 * The adapter must use a modern adaptive hashing algorithm (e.g., bcrypt,
 * Argon2id, or scrypt). The default production adapter is unavailable until
 * a supported library is confirmed and wired.
 */
export interface PasswordVerifier {
  verify(password: string, hash: string): Promise<boolean>;
  /** Perform equivalent password-hash work without using a real user's hash. */
  verifyDummy(password: string): Promise<boolean>;
  /** Hash a plaintext password for storage. */
  hash(password: string): Promise<string>;
}

export const PASSWORD_VERIFIER = Symbol("PASSWORD_VERIFIER");
