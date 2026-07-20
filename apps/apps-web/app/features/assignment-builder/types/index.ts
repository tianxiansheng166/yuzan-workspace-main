export type UserRole = "teacher" | "unknown";

export type DataState = "loading" | "ready" | "empty" | "error" | "unavailable";

export type AssignmentType =
  | "learning"
  | "first-assessment"
  | "retest"
  | "speech-practice"
  | "written-practice"
  | "composite";

export type AssignmentStatus =
  "draft" | "scheduled" | "active" | "completed" | "unavailable";

export type StudentProgressStatus =
  "not-started" | "in-progress" | "completed" | "overdue" | "unavailable";

export type ActivityStatus = "pending" | "completed" | "unavailable";

export type ContentKind = "course" | "assessment" | "activity";

export interface SelectedContent {
  id: string;
  kind: ContentKind;
  title: string;
}

export interface AssignmentDraft {
  id?: string;
  classId: string;
  type: AssignmentType;
  title: string;
  description: string;
  selectedContents: SelectedContent[];
  startsAt: string;
  dueAt: string;
  allowRetest: boolean;
  includeSpeech: boolean;
  includeWritten: boolean;
  recommendNextCourse: boolean;
}

export interface AssignmentSummary {
  id: string;
  classId: string;
  className: string;
  type: AssignmentType;
  title: string;
  status: AssignmentStatus;
  startsAt: string;
  dueAt: string;
  completionRatio: number;
  isDemo: boolean;
}

export interface StudentProgress {
  studentId: string;
  displayName: string;
  isDemo: boolean;
  progressStatus: StudentProgressStatus;
  speechStatus: ActivityStatus;
  writtenStatus: ActivityStatus;
  reportStatus: ActivityStatus;
}

export interface AssignmentDetail {
  id: string;
  classId: string;
  className: string;
  type: AssignmentType;
  title: string;
  description: string;
  status: AssignmentStatus;
  startsAt: string;
  dueAt: string;
  allowRetest: boolean;
  includeSpeech: boolean;
  includeWritten: boolean;
  recommendNextCourse: boolean;
  selectedContents: SelectedContent[];
  students: StudentProgress[];
  isDemo: boolean;
}

export interface SaveDraftResult {
  success: boolean;
  id?: string;
  demo: boolean;
  message: string;
}

export interface PublishResult {
  success: boolean;
  id?: string;
  demo: boolean;
  message: string;
}
