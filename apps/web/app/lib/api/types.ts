export type MembershipRole =
  | "STUDENT"
  | "TEACHER"
  | "RESEARCHER"
  | "SCHOOL_ADMIN"
  | "PLATFORM_ADMIN";

export interface Membership {
  schoolId: string;
  schoolName: string;
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
  error?: { code?: string; message?: string; requestId?: string };
}
