import { Injectable } from "@nestjs/common";
import type {
  ActivityProgressRecord,
  UpdateProgressInput,
} from "../domain/learning.types.js";
import { LearningUnavailableException } from "../domain/learning.errors.js";
import type { LearningRepositoryPort } from "./learning-repository.port.js";

@Injectable()
export class UnavailableLearningRepository implements LearningRepositoryPort {
  findProgress(
    _activityId: string,
    _enrollmentId: string,
  ): Promise<ActivityProgressRecord | null> {
    void _activityId;
    void _enrollmentId;
    return Promise.reject(new LearningUnavailableException());
  }

  upsertProgress(_input: UpdateProgressInput): Promise<ActivityProgressRecord> {
    void _input;
    return Promise.reject(new LearningUnavailableException());
  }

  listProgressByEnrollment(
    _enrollmentId: string,
  ): Promise<readonly ActivityProgressRecord[]> {
    void _enrollmentId;
    return Promise.reject(new LearningUnavailableException());
  }
}
