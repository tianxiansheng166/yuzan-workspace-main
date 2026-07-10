export type UserRole = "teacher" | "unknown";

export type DataState = "loading" | "ready" | "empty" | "error" | "unavailable";

export type SyncStatus = "synced" | "pending" | "offline" | "unavailable";

export type StudentAssessmentStatus =
  | "not-started"
  | "in-progress"
  | "submitted"
  | "graded"
  | "pending"
  | "unavailable";

export type StudentReportStatus =
  "ready" | "generating" | "pending" | "unavailable";

export interface ClassSummary {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
  courseCount: number;
  assessmentCount: number;
  syncStatus: SyncStatus;
}

export interface StudentSummary {
  id: string;
  displayName: string;
  isDemo: boolean;
  assessmentStatus: StudentAssessmentStatus;
  retestStatus: StudentAssessmentStatus;
  reportStatus: StudentReportStatus;
}

export interface AssessmentEntry {
  id: string;
  title: string;
  type: "formative" | "summative" | "mock";
  status: "open" | "closed" | "draft";
  dueDate?: string;
}

export interface ClassDetail {
  id: string;
  name: string;
  grade: string;
  students: StudentSummary[];
  assessments: AssessmentEntry[];
}
