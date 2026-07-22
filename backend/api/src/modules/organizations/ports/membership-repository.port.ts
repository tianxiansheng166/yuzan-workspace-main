import type {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";
import type { Membership, SchoolMember } from "../domain/organization.types.js";

export const MEMBERSHIP_REPOSITORY = Symbol("MEMBERSHIP_REPOSITORY");

export interface ListMembersOptions {
  readonly role?: MembershipRole;
  readonly status?: MembershipStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface MembershipRepositoryPort {
  findMembership(schoolId: string, userId: string): Promise<Membership | null>;
  listMembers(
    schoolId: string,
    options: ListMembersOptions,
  ): Promise<PaginatedResult<SchoolMember>>;
  listMembershipsByUser(userId: string): Promise<readonly Membership[]>;
}
