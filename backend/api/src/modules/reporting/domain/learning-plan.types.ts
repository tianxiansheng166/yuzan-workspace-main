export interface LearningPlan {
  readonly id: string;
  readonly schoolId: string;
  readonly enrollmentId: string;
  readonly authorUserId: string;
  readonly planContent: Record<string, unknown>;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SaveLearningPlanInput {
  readonly planContent: Record<string, unknown>;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly expectedRevision?: number;
}
