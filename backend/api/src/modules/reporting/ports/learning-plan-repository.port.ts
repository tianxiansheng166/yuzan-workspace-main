import type { LearningPlan, SaveLearningPlanInput } from "../domain/learning-plan.types.js";

export const LEARNING_PLAN_REPOSITORY = Symbol("LEARNING_PLAN_REPOSITORY");

export interface CreateLearningPlanData {
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly authorUserId: string;
  readonly planContent: Record<string, unknown>;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface LearningPlanRepositoryPort {
  findByEnrollmentId(schoolId: string, enrollmentId: string): Promise<LearningPlan | null>;
  create(data: CreateLearningPlanData): Promise<LearningPlan>;
  updateWithRevision(
    schoolId: string,
    enrollmentId: string,
    data: Omit<SaveLearningPlanInput, "expectedRevision">,
    expectedRevision: number,
  ): Promise<LearningPlan | null>;
}
