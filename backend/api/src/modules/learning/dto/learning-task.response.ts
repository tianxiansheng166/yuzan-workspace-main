import type { LearningTask } from "../domain/learning.types.js";

export interface LearningTaskResponse {
  readonly assignmentId: string;
  readonly title: string;
  readonly status: string;
  readonly dueAt: string;
  readonly courseVersionId: string;
  readonly courseTitle: string;
}

export function toLearningTaskResponse(task: LearningTask): LearningTaskResponse {
  return {
    assignmentId: task.assignmentId,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt.toISOString(),
    courseVersionId: task.courseVersionId,
    courseTitle: task.courseTitle,
  };
}
