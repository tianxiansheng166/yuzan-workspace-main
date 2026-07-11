export const WAITING_BACKEND = "WAITING_BACKEND" as const;
export type CoreCapability = "assignments" | "learning" | "submissions" | "feedback";
export type CoreResult<T> = { status: "ready"; data: T } | { status: typeof WAITING_BACKEND; capability: CoreCapability; message: string };

export interface TeacherAssignment { id: string; title: string; state: "draft" | "scheduled" | "active" | "closed"; dueAt?: string; }
export interface SubmissionReview { id: string; assignmentId: string; learnerName: string; state: "pending" | "reviewing" | "returned"; }
export interface FeedbackDraft { submissionId: string; body: string; isDirty: boolean; }
export interface TeacherCoreAdapter {
  listAssignments(): Promise<CoreResult<TeacherAssignment[]>>;
  listSubmissions(): Promise<CoreResult<SubmissionReview[]>>;
  saveFeedback(input: FeedbackDraft): Promise<CoreResult<FeedbackDraft>>;
}

export function createWaitingTeacherCoreAdapter(): TeacherCoreAdapter {
  const waiting = <T>(capability: CoreCapability): CoreResult<T> => ({ status: WAITING_BACKEND, capability, message: "B31-101 后端契约尚未进入当前基线。接口确认后即可在此适配器绑定。" });
  return {
    async listAssignments() { return waiting("assignments"); },
    async listSubmissions() { return waiting("submissions"); },
    async saveFeedback() { return waiting("feedback"); },
  };
}
