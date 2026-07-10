import { randomUUID } from "node:crypto";
import type {
  LearningProgress,
  LearningSession,
  Submission,
} from "../../../src/modules/learning/domain/learning.types.js";
import type {
  LearningRepositoryPort,
  SaveProgressOptions,
  SaveSessionOptions,
  SaveSubmissionOptions,
} from "../../../src/modules/learning/ports/learning-repository.port.js";

export class FakeLearningRepository implements LearningRepositoryPort {
  private readonly sessions = new Map<string, LearningSession>();
  private readonly progresses = new Map<string, LearningProgress>();
  private readonly submissions = new Map<string, Submission>();

  private sessionKey(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): string {
    return `${schoolId}:${assignmentId}:${activityId}:${studentUserId}`;
  }

  private progressKey(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): string {
    return `${schoolId}:${assignmentId}:${activityId}:${studentUserId}`;
  }

  addSession(...sessions: LearningSession[]): void {
    for (const session of sessions) {
      this.sessions.set(
        this.sessionKey(
          session.schoolId,
          session.assignmentId,
          session.activityId,
          session.studentUserId,
        ),
        session,
      );
    }
  }

  addProgress(...progresses: LearningProgress[]): void {
    for (const progress of progresses) {
      this.progresses.set(
        this.progressKey(
          progress.schoolId,
          progress.assignmentId,
          progress.activityId,
          progress.studentUserId,
        ),
        progress,
      );
    }
  }

  addSubmission(...submissions: Submission[]): void {
    for (const submission of submissions) {
      this.submissions.set(submission.id, submission);
    }
  }

  async findSession(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): Promise<LearningSession | null> {
    return (
      this.sessions.get(
        this.sessionKey(schoolId, assignmentId, activityId, studentUserId),
      ) ?? null
    );
  }

  async saveSession(
    session: LearningSession,
    options?: SaveSessionOptions,
  ): Promise<LearningSession> {
    const saved: LearningSession = {
      ...session,
      id:
        options?.generateId === false ? session.id : session.id || randomUUID(),
    };
    this.sessions.set(
      this.sessionKey(
        saved.schoolId,
        saved.assignmentId,
        saved.activityId,
        saved.studentUserId,
      ),
      saved,
    );
    return saved;
  }

  async findProgress(
    schoolId: string,
    assignmentId: string,
    activityId: string,
    studentUserId: string,
  ): Promise<LearningProgress | null> {
    return (
      this.progresses.get(
        this.progressKey(schoolId, assignmentId, activityId, studentUserId),
      ) ?? null
    );
  }

  async saveProgress(
    progress: LearningProgress,
    options?: SaveProgressOptions,
  ): Promise<LearningProgress> {
    const saved: LearningProgress = {
      ...progress,
      id:
        options?.generateId === false
          ? progress.id
          : progress.id || randomUUID(),
    };
    this.progresses.set(
      this.progressKey(
        saved.schoolId,
        saved.assignmentId,
        saved.activityId,
        saved.studentUserId,
      ),
      saved,
    );
    return saved;
  }

  async countSubmissions(
    schoolId: string,
    assignmentId: string,
    enrollmentId: string,
  ): Promise<number> {
    return Array.from(this.submissions.values()).filter(
      (s) =>
        s.schoolId === schoolId &&
        s.assignmentId === assignmentId &&
        s.enrollmentId === enrollmentId,
    ).length;
  }

  async saveSubmission(
    submission: Submission,
    options?: SaveSubmissionOptions,
  ): Promise<Submission> {
    const saved: Submission = {
      ...submission,
      id:
        options?.generateId === false
          ? submission.id
          : submission.id || randomUUID(),
    };
    this.submissions.set(saved.id, saved);
    return saved;
  }
}
