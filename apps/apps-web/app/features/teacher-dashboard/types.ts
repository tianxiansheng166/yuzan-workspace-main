import type { CurrentUser, MembershipRole } from "~/lib/api/types";

export type DashboardSourceState =
  "ready" | "empty" | "unavailable" | "forbidden" | "error";

export interface DashboardSource<T> {
  state: DashboardSourceState;
  data: T;
  message?: string;
  code?: string;
}

export interface TeacherDashboardClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export interface TeacherDashboardAssignment {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  dueAt: string;
  revision: number;
}

export interface TeacherDashboardReviewItem {
  id: string;
  assignmentId: string;
  status: string;
  submittedAt?: string;
}

export interface TeacherDashboardIntegration {
  key: string;
  enabled: boolean;
  status: string;
  publicUrl: string | null;
  lastCheckedAt: string | null;
}

export interface TeacherDashboardOperations {
  status: string;
  timestamp: string;
  version: string;
  database: string;
  activeSchools: number;
}

export interface TeacherDashboardData {
  user: CurrentUser;
  schoolId: string;
  schoolName: string;
  role: MembershipRole;
  classes: DashboardSource<TeacherDashboardClass[]>;
  assignments: DashboardSource<TeacherDashboardAssignment[]>;
  reviews: DashboardSource<TeacherDashboardReviewItem[]>;
  integrations: DashboardSource<TeacherDashboardIntegration[]>;
  operations: DashboardSource<TeacherDashboardOperations | null>;
  assessment: DashboardSource<null>;
  loadedAt: string;
}

export type TeacherDashboardLoadResult =
  | { kind: "ready"; dashboard: TeacherDashboardData }
  | { kind: "no-school"; user: CurrentUser }
  | { kind: "forbidden"; user: CurrentUser; activeRole?: MembershipRole }
  | { kind: "unavailable"; message: string; code?: string };
