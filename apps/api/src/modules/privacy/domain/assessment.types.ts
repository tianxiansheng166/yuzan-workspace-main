export type AssessmentMaterialType = "READING" | "WRITTEN_FORM" | "DIMENSION";
export type AssessmentMaterialStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface AssessmentMaterial {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly type: AssessmentMaterialType;
  readonly content: unknown | null;
  readonly version: number;
  readonly status: AssessmentMaterialStatus;
  readonly previewedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListMaterialsOptions {
  readonly schoolId: string;
  readonly limit: number;
  readonly cursor?: string;
  readonly type?: AssessmentMaterialType;
  readonly status?: AssessmentMaterialStatus;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
