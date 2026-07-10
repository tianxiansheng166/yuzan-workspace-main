import { randomUUID } from "node:crypto";
import type {
  ActivityAttempt,
  AnswerDraft,
} from "../../../src/modules/assessment/domain/assessment.types.js";
import type {
  AssessmentRepositoryPort,
  SaveAttemptOptions,
  SaveDraftOptions,
} from "../../../src/modules/assessment/ports/assessment-repository.port.js";

export class FakeAssessmentRepository implements AssessmentRepositoryPort {
  private readonly drafts = new Map<string, AnswerDraft>();
  private readonly attempts = new Map<string, ActivityAttempt>();

  private draftKey(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): string {
    return `${schoolId}:${assignmentId}:${activityId}:${studentUserId}`;
  }

  addDraft(...drafts: AnswerDraft[]): void {
    for (const draft of drafts) {
      this.drafts.set(
        this.draftKey(
          draft.schoolId,
          draft.assignmentId,
          draft.activityId,
          draft.studentUserId,
        ),
        draft,
      );
    }
  }

  addAttempt(...attempts: ActivityAttempt[]): void {
    for (const attempt of attempts) {
      this.attempts.set(attempt.id, attempt);
    }
  }

  async findDraft(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): Promise<AnswerDraft | null> {
    return (
      this.drafts.get(
        this.draftKey(schoolId, assignmentId, activityId, studentUserId),
      ) ?? null
    );
  }

  async saveDraft(
    draft: AnswerDraft,
    options?: SaveDraftOptions,
  ): Promise<AnswerDraft> {
    const saved: AnswerDraft = {
      ...draft,
      id: options?.generateId === false ? draft.id : draft.id || randomUUID(),
    };
    this.drafts.set(
      this.draftKey(
        saved.schoolId,
        saved.assignmentId,
        saved.activityId,
        saved.studentUserId,
      ),
      saved,
    );
    return saved;
  }

  async countAttempts(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    enrollmentId: string,
  ): Promise<number> {
    return Array.from(this.attempts.values()).filter(
      (a) =>
        a.schoolId === schoolId &&
        a.assignmentId === assignmentId &&
        a.activityId === activityId &&
        a.enrollmentId === enrollmentId,
    ).length;
  }

  async findAttempts(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    enrollmentId: string,
  ): Promise<readonly ActivityAttempt[]> {
    return Array.from(this.attempts.values()).filter(
      (a) =>
        a.schoolId === schoolId &&
        a.assignmentId === assignmentId &&
        a.activityId === activityId &&
        a.enrollmentId === enrollmentId,
    );
  }

  async findAttemptById(
    schoolId: string,
    attemptId: string,
  ): Promise<ActivityAttempt | null> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.schoolId !== schoolId) {
      return null;
    }
    return attempt;
  }

  async saveAttempt(
    attempt: ActivityAttempt,
    options?: SaveAttemptOptions,
  ): Promise<ActivityAttempt> {
    const saved: ActivityAttempt = {
      ...attempt,
      id:
        options?.generateId === false ? attempt.id : attempt.id || randomUUID(),
    };
    this.attempts.set(saved.id, saved);
    return saved;
  }
}
