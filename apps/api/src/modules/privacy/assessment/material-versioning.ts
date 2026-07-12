import type { AssessmentMaterial } from "../domain/assessment.types.js";
import { randomUUID } from "node:crypto";

/**
 * Increment the version number for a new draft.
 */
export function bumpVersion(currentVersion: number): number {
  return currentVersion + 1;
}

/**
 * Create a new draft material from an existing published/archived material,
 * with the version bumped by one.
 */
export function createDraftFromExisting(
  existing: AssessmentMaterial,
): AssessmentMaterial {
  const now = new Date();
  return {
    id: randomUUID(),
    schoolId: existing.schoolId,
    title: existing.title,
    type: existing.type,
    content: existing.content,
    version: bumpVersion(existing.version),
    status: "DRAFT",
    previewedAt: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
