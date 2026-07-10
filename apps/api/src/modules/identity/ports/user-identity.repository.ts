import type { UserIdentity } from "../identity.types.js";

/**
 * Port for loading user identity by login identifier.
 *
 * Production implementations query the read-optimized identity store.
 * The default adapter is unavailable until the persistence layer is ready.
 */
export interface UserIdentityRepository {
  findByIdentifier(identifier: string): Promise<UserIdentity | null>;
  findById(userId: string): Promise<UserIdentity | null>;
}

export const USER_IDENTITY_REPOSITORY = Symbol("USER_IDENTITY_REPOSITORY");
