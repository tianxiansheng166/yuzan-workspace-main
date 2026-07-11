import type {
  ActivityProgressRecord,
  UpdateProgressInput,
} from "../domain/learning.types.js";

export const LEARNING_REPOSITORY = Symbol("LEARNING_REPOSITORY");

export interface LearningRepositoryPort {
  findProgress(
    activityId: string,
    enrollmentId: string,
  ): Promise<ActivityProgressRecord | null>;

  upsertProgress(input: UpdateProgressInput): Promise<ActivityProgressRecord>;

  listProgressByEnrollment(
    enrollmentId: string,
  ): Promise<readonly ActivityProgressRecord[]>;
}
