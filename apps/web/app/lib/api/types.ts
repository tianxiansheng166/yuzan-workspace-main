import type { components } from "../../../../../packages/contracts/src/generated";

type ContractMembership = components["schemas"]["Membership"];

export type MembershipRole = ContractMembership["role"] | "VOLUNTEER";

export interface Membership extends Omit<ContractMembership, "role"> {
  role: MembershipRole;
}

export interface CurrentUser {
  id: string;
  displayName: string;
  preferredLocale: string;
  activeSchoolId?: string;
  memberships: Membership[];
}

export interface AuthSessionResponse {
  data: {
    accessToken: string;
    activeSchoolId: string | null;
    expiresIn: number;
    user: CurrentUser;
  };
  meta: { requestId: string };
}

export interface CurrentUserResponse {
  data: CurrentUser;
  meta: { requestId: string };
}

export interface CourseVersionSummary {
  id: string;
  courseId: string;
  version: number;
  title: string;
  status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED" | "RETIRED";
  gradeBand: string | null;
  updatedAt: string;
}

export interface CourseVersionDetail extends CourseVersionSummary {
  schoolId: string;
  authorUserId: string;
  description?: string;
  locale: string;
  objectives: unknown[];
  units: unknown[];
  createdAt: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: { requestId: string };
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    scope?: string;
    requestId?: string;
  };
  meta?: { requestId?: string };
}
