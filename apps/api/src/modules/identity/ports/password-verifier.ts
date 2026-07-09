/**
 * Port for password verification.
 *
 * The adapter must use a modern adaptive hashing algorithm (e.g., bcrypt,
 * Argon2id, or scrypt). The default production adapter is unavailable until
 * a supported library is confirmed and wired.
 */
export interface PasswordVerifier {
  verify(password: string, hash: string): Promise<boolean>;
}

export const PASSWORD_VERIFIER = Symbol("PASSWORD_VERIFIER");
