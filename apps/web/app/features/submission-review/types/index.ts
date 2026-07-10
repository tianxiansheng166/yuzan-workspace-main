export type SubmissionReviewStatus =
  | "needs-review"
  | "priority"
  | "returned"
  | "resubmitted"
  | "completed"
  | "unavailable";

export type SubmissionType =
  | "initial-assessment"
  | "retest"
  | "reading-practice"
  | "written-practice"
  | "integrated-task";

export type ReviewPermission =
  "teacher" | "demo-teacher" | "student" | "unknown";

export type ReviewScenario =
  | "default"
  | "empty"
  | "error"
  | "unavailable"
  | "student-role"
  | "unknown-role"
  | "demo-teacher";

export type ReviewPageState =
  "loading" | "ready" | "empty" | "error" | "permission" | "unavailable";

export type AiAssistState = "demo" | "pending" | "unavailable";

export type ReportState = "pending" | "ready" | "unavailable";

export type RecommendationState = "demo" | "accepted" | "adjusted" | "pending";

export type TeacherReviewState =
  "pending" | "in-review" | "reviewed" | "returned" | "unavailable";

export interface SubmissionSummary {
  id: string;
  className: string;
  studentDisplayName: string;
  assignmentTitle: string;
  submissionType: SubmissionType;
  submittedAt: string;
  reviewStatus: SubmissionReviewStatus;
  aiAssistState: AiAssistState;
  marker: "demo" | "pending" | "unavailable";
  isOverdue: boolean;
  needsAttention: boolean;
  evidenceComplete: boolean;
}

export interface AudioSubmissionMetadata {
  recordingSubmitted: boolean;
  durationLabel: string;
  recordedAt: string;
  captureDevice: string;
  fileStatus: "demo" | "pending" | "unavailable";
  aiProcessingStatus: AiAssistState;
}

export interface WrittenExerciseEntry {
  prompt: string;
  answer: string;
  completionState: "complete" | "partial" | "unavailable";
  teacherComment: string;
  redoSuggestion: string;
}

export interface LearningEvidence {
  id: string;
  label: string;
  detail: string;
  status: "available" | "pending" | "unavailable";
}

export interface AttemptReference {
  kind: "initial-assessment" | "retest";
  roundLabel: string;
  previousSubmissionId: string | null;
  historyEntryState: "available" | "pending" | "unavailable";
}

export interface RecommendationEntry {
  title: string;
  state: RecommendationState;
  note: string;
}

export interface SubmissionDetail extends SubmissionSummary {
  schoolScopedLabel: string;
  taskDescription: string;
  readingTextTitle: string;
  audioMetadata: AudioSubmissionMetadata;
  writtenExercises: WrittenExerciseEntry[];
  learningEvidence: LearningEvidence[];
  attempt: AttemptReference;
  reportState: ReportState;
  recommendationEntries: RecommendationEntry[];
  teacherReviewState: TeacherReviewState;
  reviewHistory: Array<{
    id: string;
    actorLabel: string;
    at: string;
    action: string;
    note: string;
  }>;
}

export interface TeacherFeedbackDraft {
  submissionId: string;
  strengths: string;
  priorityIssue: string;
  nextAction: string;
  sectionFeedback: string;
  summary: string;
  reviewStatus: "reviewed" | "returned" | "unavailable";
  needsRedo: boolean;
  returnReason: string;
  retestRecommended: boolean;
  retestGoal: string;
  focusAreas: string[];
}

export interface TeacherFeedbackResult {
  kind: "demo-saved" | "unavailable";
  message: string;
  persisted: false;
}

export interface FeedbackValidationIssue {
  field: keyof TeacherFeedbackDraft;
  message: string;
}

export interface FeedbackValidationResult {
  valid: boolean;
  issues: FeedbackValidationIssue[];
}

export interface SubmissionReviewDashboardResult {
  permission: ReviewPermission;
  generatedAt: string;
  submissions: SubmissionSummary[] | null;
}

export interface SubmissionReviewDetailResult {
  permission: ReviewPermission;
  submission: SubmissionDetail | null;
}

export interface SubmissionReviewGateway {
  getDashboard(
    scenario?: ReviewScenario,
  ): Promise<SubmissionReviewDashboardResult>;
  getSubmissionDetail(
    submissionId: string,
    scenario?: ReviewScenario,
  ): Promise<SubmissionReviewDetailResult>;
  getFeedbackContext(
    submissionId: string,
    scenario?: ReviewScenario,
  ): Promise<SubmissionReviewDetailResult>;
  saveFeedbackDraft(
    draft: TeacherFeedbackDraft,
    scenario?: ReviewScenario,
  ): Promise<TeacherFeedbackResult>;
  submitFeedback(
    draft: TeacherFeedbackDraft,
    scenario?: ReviewScenario,
  ): Promise<TeacherFeedbackResult>;
}
