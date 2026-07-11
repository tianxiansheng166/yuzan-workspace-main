import type { ActivityProgressRecord } from "../../../../src/modules/learning/domain/learning.types.js";

export function progressRecord(overrides: Partial<ActivityProgressRecord> = {}): ActivityProgressRecord {
  return {
    id: "progress-1",
    schoolId: "school-a",
    activityId: "activity-1",
    enrollmentId: "enrollment-1",
    position: 0,
    completed: false,
    revision: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}
