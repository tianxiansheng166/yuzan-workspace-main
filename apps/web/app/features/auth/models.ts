export type UserRole = "student" | "teacher" | "admin";

export type AuthViewStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "expired"
  | "error"
  | "unavailable";

export type ServiceMode = "demo" | "pending" | "unavailable" | "live";

export interface AuthenticatedSession {
  status: "authenticated";
  role: UserRole;
  serviceMode: ServiceMode;
  expiresAt?: string;
}

export interface UnauthenticatedSession {
  status: "unauthenticated";
  serviceMode: ServiceMode;
  message?: string;
}

export interface ExpiredSession {
  status: "expired";
  serviceMode: ServiceMode;
  message?: string;
}

export interface ErrorSession {
  status: "error";
  serviceMode: ServiceMode;
  message: string;
}

export interface UnavailableSession {
  status: "unavailable";
  serviceMode: Exclude<ServiceMode, "live">;
  message: string;
}

export type SessionSnapshot =
  | AuthenticatedSession
  | UnauthenticatedSession
  | ExpiredSession
  | ErrorSession
  | UnavailableSession;

export interface AuthCredentials {
  identifier: string;
  password: string;
  redirectTo?: string;
}

export type AuthResult =
  | {
      status: "authenticated";
      role: string;
      serviceMode: ServiceMode;
      expiresAt?: string;
    }
  | {
      status: "unauthenticated";
      serviceMode: ServiceMode;
      message: string;
    }
  | {
      status: "expired";
      serviceMode: ServiceMode;
      message: string;
    }
  | {
      status: "error";
      serviceMode: ServiceMode;
      message: string;
    }
  | {
      status: "unavailable";
      serviceMode: Exclude<ServiceMode, "live">;
      message: string;
    };

export interface LoginPageState {
  status: AuthViewStatus;
  serviceMode: ServiceMode;
  identifier: string;
  password: string;
  redirectTo?: string;
  role?: UserRole;
  message?: string;
  submitting: boolean;
}

export interface SchoolOption {
  schoolId: string;
  schoolName: string;
  role: UserRole;
}

export interface WebSession {
  userId: string;
  displayName: string;
  memberships: SchoolOption[];
  activeSchoolId?: string;
}
