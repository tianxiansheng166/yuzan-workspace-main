import type { AssessmentMaterial } from "../domain/assessment.types.js";

export interface MaterialResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly type: string;
  readonly content: unknown | null;
  readonly version: number;
  readonly status: string;
  readonly previewedAt: string | null;
  readonly publishedAt: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toMaterialResponse(
  material: AssessmentMaterial,
): MaterialResponse {
  return {
    id: material.id,
    schoolId: material.schoolId,
    title: material.title,
    type: material.type,
    content: material.content,
    version: material.version,
    status: material.status,
    previewedAt: material.previewedAt?.toISOString() ?? null,
    publishedAt: material.publishedAt?.toISOString() ?? null,
    archivedAt: material.archivedAt?.toISOString() ?? null,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}
