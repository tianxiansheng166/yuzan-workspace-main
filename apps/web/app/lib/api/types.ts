export interface Membership {
  schoolId: string;
  schoolName: string;
  role:
    "STUDENT" | "TEACHER" | "RESEARCHER" | "SCHOOL_ADMIN" | "PLATFORM_ADMIN";
}

export interface CurrentUser {
  id: string;
  displayName: string;
  preferredLocale: string;
  memberships: Membership[];
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
}

export interface AuthSessionResponse {
  data: AuthSession;
  meta: { requestId: string };
}

export interface CurrentUserResponse {
  data: CurrentUser;
  meta: { requestId: string };
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; requestId?: string };
}
