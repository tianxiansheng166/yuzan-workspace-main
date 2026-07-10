import { Injectable } from "@nestjs/common";
import type {
  LearningProgress,
  LearningSession,
  Submission,
} from "../domain/learning.types.js";
import { LearningUnavailableException } from "../domain/learning.errors.js";
import type {
  LearningRepositoryPort,
  SaveProgressOptions,
  SaveSessionOptions,
  SaveSubmissionOptions,
} from "./learning-repository.port.js";

@Injectable()
export class UnavailableLearningRepository implements LearningRepositoryPort {
  findSession(
    _schoolId: string,
    _assignmentId: string,
    _activityId: string,
    _studentUserId: string,
  ): Promise<LearningSession | null> {
    throw new LearningUnavailableException();
  }

  saveSession(
    _session: LearningSession,
    _options?: SaveSessionOptions,
  ): Promise<LearningSession> {
    throw new LearningUnavailableException();
  }

  findProgress(
    _schoolId: string,
    _assignmentId: string,
    _activityId: string,
    _studentUserId: string,
  ): Promise<LearningProgress | null> {
    throw new LearningUnavailableException();
  }

  saveProgress(
    _progress: LearningProgress,
    _options?: SaveProgressOptions,
  ): Promise<LearningProgress> {
    throw new LearningUnavailableException();
  }

  countSubmissions(
    _schoolId: string,
    _assignmentId: string,
    _enrollmentId: string,
  ): Promise<number> {
    throw new LearningUnavailableException();
  }

  saveSubmission(
    _submission: Submission,
    _options?: SaveSubmissionOptions,
  ): Promise<Submission> {
    throw new LearningUnavailableException();
  }
}
