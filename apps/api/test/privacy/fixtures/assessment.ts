import { randomUUID } from "node:crypto";
import type {
  AssessmentMaterial,
  AssessmentMaterialStatus,
} from "../../../src/modules/privacy/domain/assessment.types.js";

export function assessmentMaterial(
  overrides: Partial<AssessmentMaterial> = {},
): AssessmentMaterial {
  const now = new Date();
  return {
    id: randomUUID(),
    schoolId: randomUUID(),
    title: "阅读测评材料",
    type: "READING",
    content: null,
    version: 1,
    status: "DRAFT" as AssessmentMaterialStatus,
    previewedAt: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
