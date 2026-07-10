import type { Assignment } from "../../../src/modules/assignments/domain/assignment.types.js";

export function assignment(
  overrides: Partial<Assignment> &
    Pick<
      Assignment,
      "id" | "schoolId" | "classId" | "courseVersionId" | "title"
    >,
): Assignment {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    activityRefs: [],
    status: "DRAFT",
    latePolicy: "ACCEPT",
    retryPolicy: { maxAttempts: 1, allowRetest: false },
    createdByUserId: "teacher-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
