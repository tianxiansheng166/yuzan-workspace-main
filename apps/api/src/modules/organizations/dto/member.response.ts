import type {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";
import type { Membership, SchoolMember } from "../domain/organization.types.js";

export interface MemberResponse {
  readonly userId: string;
  readonly displayName: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
}

export function toMemberResponse(member: SchoolMember): MemberResponse {
  return {
    userId: member.userId,
    displayName: member.displayName,
    role: member.role,
    status: member.status,
  };
}

export interface MembershipResponse {
  readonly schoolId: string;
  readonly schoolName: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  readonly joinedAt: string;
}

export function toMembershipResponse(
  schoolName: string,
  membership: Membership,
): MembershipResponse {
  return {
    schoolId: membership.schoolId,
    schoolName,
    role: membership.role,
    status: membership.status,
    joinedAt: membership.joinedAt.toISOString(),
  };
}
