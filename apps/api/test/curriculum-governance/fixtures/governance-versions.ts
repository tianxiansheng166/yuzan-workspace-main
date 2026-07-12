import { randomUUID } from "node:crypto";
import type { GovernanceCourseVersion } from "../../../src/modules/curriculum-governance/domain/governance.types.js";

export function governanceCourseVersion(overrides: Partial<GovernanceCourseVersion> = {}): GovernanceCourseVersion {
  const now = new Date();
  return {
    id: randomUUID(),
    schoolId: "school-a",
    courseId: randomUUID(),
    version: 1,
    status: "DRAFT",
    title: "测试课程版本",
    description: null,
    gradeBand: null,
    locale: "zh-CN",
    objectives: [],
    submittedAt: null,
    approvedAt: null,
    publishedAt: null,
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
