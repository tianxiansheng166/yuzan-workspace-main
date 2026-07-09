export type ReviewRole = "teacher" | "observer" | "unknown";

export type ReviewState =
  "loading" | "ready" | "empty" | "error" | "permission" | "unavailable";

export type QueueLane = "incomplete" | "low-confidence" | "sync-exception";

export type ReviewStatus =
  "needs-review" | "reviewed" | "returned" | "accepted" | "unavailable";

export type EvidenceKind = "audio" | "writing" | "reading";

export type ConfidenceBand = "low" | "medium" | "high" | "unavailable";

export type SyncHealth = "synced" | "pending" | "failed" | "unavailable";

export interface ReviewSubmissionSummary {
  id: string;
  studentName: string;
  className: string;
  assignmentTitle: string;
  lane: QueueLane;
  evidenceKind: EvidenceKind;
  reviewStatus: ReviewStatus;
  confidenceBand: ConfidenceBand;
  syncHealth: SyncHealth;
  submittedAt: string;
  issueSummary: string;
  isDemo: boolean;
}

export interface EvidenceArtifact {
  id: string;
  label: string;
  status: "available" | "pending" | "unavailable";
  note: string;
}

export interface TeacherChecklistItem {
  id: string;
  label: string;
  status: "done" | "pending" | "attention";
  note: string;
}

export interface ReviewHistoryEntry {
  id: string;
  actor: string;
  action: string;
  at: string;
  detail: string;
}

export interface ReviewSubmissionDetail extends ReviewSubmissionSummary {
  prompt: string;
  studentResponse: string;
  transcript: string;
  autoSuggestion: string;
  autoRationale: string;
  recommendedOutcome: "accept" | "return" | "offline-support";
  modelVersion: string;
  confidenceScore: string;
  teacherDraftNote: string;
  teacherDecision: string;
  artifacts: EvidenceArtifact[];
  checklist: TeacherChecklistItem[];
  history: ReviewHistoryEntry[];
}
