import { randomUUID } from "node:crypto";
import type {
  AssessmentLink,
  AssessmentLinkStatus,
} from "../../../src/modules/product-plans/domain/link.types.js";

export function assessmentLink(
  overrides: Partial<AssessmentLink> = {},
): AssessmentLink {
  const now = new Date();
  return {
    id: randomUUID(),
    schoolId: "school-1",
    assignmentId: randomUUID(),
    tokenHash: randomUUID(),
    status: "ACTIVE" as AssessmentLinkStatus,
    usageCount: 0,
    expiresAt: null,
    disabledAt: null,
    regeneratedFromId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
