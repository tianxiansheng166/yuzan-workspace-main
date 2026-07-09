import { IdentityException } from "../identity.errors.js";
import type { UserIdentity, UserMembership } from "../identity.types.js";
import type {
  MembershipRepository,
  UserIdentityRepository,
} from "../ports/index.js";

/**
 * Fail-closed identity repository adapter.
 *
 * Used as the production default until a real persistence layer is wired.
 * All lookups fail with AUTH_SERVICE_UNAVAILABLE.
 */
export class UnavailableIdentityRepository
  implements UserIdentityRepository, MembershipRepository
{
  async findByIdentifier(_identifier: string): Promise<UserIdentity | null> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async findById(_userId: string): Promise<UserIdentity | null> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async findActiveMembershipsByUser(
    _userId: string,
  ): Promise<readonly UserMembership[]> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }

  async findByUserAndSchool(
    _userId: string,
    _schoolId: string,
  ): Promise<UserMembership | null> {
    throw new IdentityException("AUTH_SERVICE_UNAVAILABLE");
  }
}
