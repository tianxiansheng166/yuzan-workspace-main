/**
 * DTO for POST /schools/:schoolId/ai/lesson-plan-jobs
 *
 * Creates an idempotent AI lesson-plan generation job.
 * If an idempotencyKey is provided and a matching job already exists,
 * the existing job is returned without creating a new one.
 */
export interface CreateLessonPlanJobDto {
  /** Free-text teaching goal provided by the teacher. */
  goal: string;

  /** Optional: link to an existing course version for context. */
  courseVersionId?: string;

  /** Optional: link to a specific unit within the course version. */
  unitId?: string;

  /** Optional: link to a specific lesson within the course. */
  lessonId?: string;

  /** Grade band, e.g. "G1-2", "G3-4", "G5-6". */
  gradeBand?: string;

  /** Subject, e.g. "语文", "数学". */
  subject?: string;

  /** Lesson duration in minutes. */
  durationMinutes?: number;

  /** Key requirements for the lesson plan. */
  keyRequirements?: string;

  /** Output modules to include, e.g. ["objectives", "flow", "worksheet"]. */
  outputModules?: string[];

  /** Locale for output, defaults to "zh-CN". */
  locale?: string;

  /**
   * Client-generated idempotency key.
   * If provided, the server will return the existing job if one matches,
   * preventing duplicate submissions on retry.
   */
  idempotencyKey?: string;
}
