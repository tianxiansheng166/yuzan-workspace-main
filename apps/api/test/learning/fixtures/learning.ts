import type {
  LearningProgress,
  LearningSession,
  Submission,
} from "../../../src/modules/learning/domain/learning.types.js";

export function learningSession(
  overrides: Partial<LearningSession> &
    Pick<
      LearningSession,
      | "id"
      | "schoolId"
      | "assignmentId"
      | "activityId"
      | "studentUserId"
      | "enrollmentId"
    >,
): LearningSession {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    status: "ACTIVE",
    startedAt: now,
    lastActiveAt: now,
    ...overrides,
  };
}

export function learningProgress(
  overrides: Partial<LearningProgress> &
    Pick<
      LearningProgress,
      | "id"
      | "schoolId"
      | "assignmentId"
      | "activityId"
      | "studentUserId"
      | "enrollmentId"
      | "sessionId"
    >,
): LearningProgress {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    progressPercent: 0,
    localState: {},
    serverState: {},
    updatedAt: now,
    ...overrides,
  };
}

export function submission(
  overrides: Partial<Submission> &
    Pick<
      Submission,
      "id" | "schoolId" | "assignmentId" | "enrollmentId" | "attemptNo"
    >,
): Submission {
  return {
    activityIds: [],
    status: "SUBMITTED",
    submittedAt: new Date("2026-07-10T00:00:00Z"),
    ...overrides,
  };
}
