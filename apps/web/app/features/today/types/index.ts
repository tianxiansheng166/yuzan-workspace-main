export type LearningProgressState =
  | "not-started"
  | "ready"
  | "in-progress"
  | "paused"
  | "local-only"
  | "pending-sync"
  | "submitted"
  | "needs-revision"
  | "retest-recommended"
  | "completed"
  | "unavailable";

export type ActivityType =
  | "reading"
  | "speaking"
  | "writing"
  | "listening"
  | "language-practice"
  | "initial-assessment"
  | "retest"
  | "integrated";

export interface TodayActivity {
  id: string;
  title: string;
  reason: string;
  durationMinutes: number;
  completion: string;
  help: string;
  type: ActivityType;
  state: LearningProgressState;
  priority: number;
  teacherAdvice?: string;
}

export type TodayScenario = "demo" | "empty" | "unavailable" | "permission";

export interface TodayResult {
  marker: "demo" | "unavailable";
  permitted: boolean;
  activities: TodayActivity[] | null;
}
