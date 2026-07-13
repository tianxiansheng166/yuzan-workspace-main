import type { MembershipRole } from "../../lib/api/types";

export type { MembershipRole };

export interface SchoolMembership {
  schoolId: string;
  schoolName: string;
  role: MembershipRole | string;
  region?: string;
  schoolType?: string;
  membershipStatus?: "active" | "inactive" | "deleted";
  schoolStatus?: "active" | "inactive" | "deleted";
  lastUsedAt?: string;
}

export interface CurrentSchoolUser {
  id: string;
  displayName: string;
  activeSchoolId?: string | null;
  memberships: SchoolMembership[];
}


export interface ActiveSchoolContext {
  schoolId: string;
  schoolName: string;
  role: MembershipRole;
  selectedAt: string;
}

export type SchoolSelectionState =
  | "LOADING_MEMBERSHIPS"
  | "NO_SCHOOL"
  | "ONE_SCHOOL"
  | "MULTIPLE_SCHOOLS"
  | "SELECTING"
  | "SELECTED"
  | "SELECTION_FAILED"
  | "MEMBERSHIP_INACTIVE"
  | "SCHOOL_INACTIVE"
  | "SESSION_EXPIRED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ROLE";

export type MembershipLoadResult =
  | { status: "ready"; user: CurrentSchoolUser }
  | { status: "session-expired"; message: string }
  | { status: "network-error"; message: string };

export type SchoolSelectionResult =
  | { status: "selected"; context: ActiveSchoolContext }
  | { status: "membership-inactive"; message: string }
  | { status: "school-inactive"; message: string }
  | { status: "session-expired"; message: string }
  | { status: "network-error"; message: string }
  | { status: "unknown-role"; message: string }
  | { status: "failed"; message: string };
