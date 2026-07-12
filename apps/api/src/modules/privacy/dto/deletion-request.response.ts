import type { DataDeletionRequest } from "../domain/privacy.types.js";

export interface DeletionRequestResponse {
  readonly id: string;
  readonly userId: string;
  readonly schoolId: string | null;
  readonly status: string;
  readonly requestedAt: string;
  readonly approvedAt: string | null;
  readonly completedAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toDeletionRequestResponse(
  request: DataDeletionRequest,
): DeletionRequestResponse {
  return {
    id: request.id,
    userId: request.userId,
    schoolId: request.schoolId,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    approvedAt: request.approvedAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    notes: request.notes,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
