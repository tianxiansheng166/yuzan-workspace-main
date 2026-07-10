import type {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";

export interface School {
  readonly id: string;
  readonly name: string;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Membership {
  readonly userId: string;
  readonly schoolId: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  readonly joinedAt: Date;
}

export interface SchoolMember {
  readonly userId: string;
  readonly displayName: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
}

export interface SchoolSummary {
  readonly id: string;
  readonly name: string;
  readonly status: "ACTIVE" | "INACTIVE";
}

export interface MembershipSummary {
  readonly schoolId: string;
  readonly schoolName: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
}
