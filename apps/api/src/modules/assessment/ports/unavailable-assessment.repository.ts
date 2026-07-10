import { Injectable } from "@nestjs/common";
import { AssessmentUnavailableException } from "../domain/assessment.errors.js";
import type {
  ActivityAttempt,
  AnswerDraft,
} from "../domain/assessment.types.js";
import type {
  AssessmentRepositoryPort,
  SaveAttemptOptions,
  SaveDraftOptions,
} from "./assessment-repository.port.js";

@Injectable()
export class UnavailableAssessmentRepository implements AssessmentRepositoryPort {
  findDraft(
    _schoolId: string,
    _assignmentId: string,
    _activityId: string,
    _studentUserId: string,
  ): Promise<AnswerDraft | null> {
    throw new AssessmentUnavailableException();
  }

  saveDraft(
    _draft: AnswerDraft,
    _options?: SaveDraftOptions,
  ): Promise<AnswerDraft> {
    throw new AssessmentUnavailableException();
  }

  countAttempts(
    _schoolId: string,
    _assignmentId: string,
    _activityId: string,
    _enrollmentId: string,
  ): Promise<number> {
    throw new AssessmentUnavailableException();
  }

  findAttempts(
    _schoolId: string,
    _assignmentId: string,
    _activityId: string,
    _enrollmentId: string,
  ): Promise<readonly ActivityAttempt[]> {
    throw new AssessmentUnavailableException();
  }

  findAttemptById(
    _schoolId: string,
    _attemptId: string,
  ): Promise<ActivityAttempt | null> {
    throw new AssessmentUnavailableException();
  }

  saveAttempt(
    _attempt: ActivityAttempt,
    _options?: SaveAttemptOptions,
  ): Promise<ActivityAttempt> {
    throw new AssessmentUnavailableException();
  }
}
