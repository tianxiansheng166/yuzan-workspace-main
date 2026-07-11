import type {
  ActivityProgressRecord,
  LearningActivityDetail,
} from "../domain/learning.types.js";

export interface ActivityProgressResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly activityId: string;
  readonly enrollmentId: string;
  readonly position: number;
  readonly completed: boolean;
  readonly revision: number;
  readonly updatedAt: string;
}

export function toActivityProgressResponse(
  record: ActivityProgressRecord,
): ActivityProgressResponse {
  return {
    id: record.id,
    schoolId: record.schoolId,
    activityId: record.activityId,
    enrollmentId: record.enrollmentId,
    position: record.position,
    completed: record.completed,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export interface LearningActivityResponse {
  readonly activityId: string;
  readonly title: string;
  readonly type: string;
  readonly instruction?: string;
  readonly sortOrder: number;
  readonly required: boolean;
  readonly progress?: ActivityProgressResponse;
}

export function toLearningActivityResponse(
  detail: LearningActivityDetail,
): LearningActivityResponse {
  return {
    activityId: detail.activityId,
    title: detail.title,
    type: detail.type,
    ...(detail.instruction ? { instruction: detail.instruction } : {}),
    sortOrder: detail.sortOrder,
    required: detail.required,
    ...(detail.progress ? { progress: toActivityProgressResponse(detail.progress) } : {}),
  };
}
