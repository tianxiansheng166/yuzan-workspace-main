/**
 * Response shape for an AI generation job.
 */
export interface LessonPlanJobResponse {
  id: string;
  schoolId: string;
  teacherId: string;
  status: string;
  idempotencyKey: string | null;
  inputSnapshot: Record<string, unknown> | null;
  outputSnapshot: Record<string, unknown> | null;
  errorCode: string | null;
  latencyMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** ID of the lesson plan draft created on success, if any. */
  lessonPlanDraftId: string | null;
}

/**
 * Response shape for a lesson plan draft.
 */
export interface LessonPlanDraftResponse {
  id: string;
  schoolId: string;
  teacherId: string;
  courseVersionId: string | null;
  lessonId: string | null;
  generationJobId: string;
  title: string;
  content: Record<string, unknown>;
  revision: number;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response shape for the workflow status endpoint.
 */
export interface WorkflowStatusResponse {
  workflowKey: string;
  status: string;
  version: string;
  provider: string;
  externalFlowId: string | null;
  providerAvailable: boolean;
  message: string | null;
}
