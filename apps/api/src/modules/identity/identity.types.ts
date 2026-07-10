import type {
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";

/**
 * Minimal user identity returned by the identity repository.
 *
 * Intentionally free of PII beyond displayName, which is required by the
 * CurrentUser contract. No password or secrets are included.
 */
export interface UserIdentity {
  readonly id: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly preferredLocale: string;
  readonly status: UserStatus;
  /**
   * Password hash for verification. The service never returns this field
   * in API responses.
   */
  readonly passwordHash: string;
}

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

/**
 * Membership as seen by the identity domain.
 */
export interface UserMembership {
  readonly id: string;
  readonly schoolId: string;
  readonly schoolName: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
}

/**
 * Session record returned by the session repository.
 *
 * The repository stores token hashes; the raw token is only available once
 * immediately after creation.
 */
export interface UserSession {
  readonly id: string;
  readonly userId: string;
  readonly activeSchoolId: string | null;
  readonly accessTokenHash: string;
  readonly refreshTokenHash: string;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
}

/**
 * Opaque token pair created on login or refresh.
 */
export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
}

/**
 * Internal result of a successful login or refresh.
 */
export interface IdentitySession {
  readonly user: UserIdentity;
  readonly memberships: readonly UserMembership[];
  readonly activeSchoolId: string | null;
  readonly tokens: TokenPair;
}

/**
 * Current user shape aligned with the OpenAPI CurrentUser schema.
 */
export interface CurrentUser {
  readonly id: string;
  readonly displayName: string;
  readonly preferredLocale: string;
  readonly memberships: readonly {
    readonly schoolId: string;
    readonly schoolName: string;
    readonly role: MembershipRole;
  }[];
}
