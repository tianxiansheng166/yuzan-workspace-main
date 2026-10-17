import type { Assignment } from "../../../../src/modules/assignments/domain/assignment.types.js";

export function assignment(overrides: Partial<Assignment> = {}): Assignment {
  const now = new Date();
  return {
    id: "assignment-1",
    schoolId: "school-a",
    courseVersionId: "cv-1",
    createdByUserId: "teacher-1",
    title: "Test Assignment",
    status: "DRAFT",
    startsAt: now,
    dueAt: new Date(now.getTime() + 86400000),
    offlineRequired: false,
    revision: 1,
    targets: [
      {
        id: "target-1",
        schoolId: "school-a",
        assignmentId: "assignment-1",
        targetType: "CLASS",
        classId: "class-1",
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
