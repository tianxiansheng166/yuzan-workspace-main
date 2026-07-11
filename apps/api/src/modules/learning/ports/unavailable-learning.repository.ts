import { Injectable } from "@nestjs/common";
import type {
  ActivityProgressRecord,
  UpdateProgressInput,
} from "../domain/learning.types.js";
import { LearningUnavailableException } from "../domain/learning.errors.js";
import type { LearningRepositoryPort } from "./learning-repository.port.js";

@Injectable()
export class UnavailableLearningRepository implements LearningRepositoryPort {
  async findProgress(
    _activityId: string,
    _enrollmentId: string,
  ): Promise<ActivityProgressRecord | null> {
    throw new LearningUnavailableException();
  }

  async upsertProgress(
    _input: UpdateProgressInput,
  ): Promise<ActivityProgressRecord> {
    throw new LearningUnavailableException();
  }

  async listProgressByEnrollment(
    _enrollmentId: string,
  ): Promise<readonly ActivityProgressRecord[]> {
    throw new LearningUnavailableException();
  }
}
