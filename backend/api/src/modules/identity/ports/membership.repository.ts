import type {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";
import type { UserMembership } from "../identity.types.js";

/**
 * Port for loading user memberships.
 *
 * Memberships carry the authoritative role and status for a school. The
 * identity service uses this port to validate tenant scope and build the
 * principal's roles/permissions from server-side data only.
 */
export interface MembershipRepository {
  findActiveMembershipsByUser(
    userId: string,
  ): Promise<readonly UserMembership[]>;
  findByUserAndSchool(
    userId: string,
    schoolId: string,
  ): Promise<UserMembership | null>;
}

export const MEMBERSHIP_REPOSITORY = Symbol("MEMBERSHIP_REPOSITORY");
