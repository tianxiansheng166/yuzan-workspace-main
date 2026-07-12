import type { AssessmentLink } from "../domain/link.types.js";

export interface AssessmentLinkResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly tokenPreview: string;
  readonly status: string;
  readonly usageCount: number;
  readonly expiresAt: string | null;
  readonly disabledAt: string | null;
  readonly regeneratedFromId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Mask token to show only last 4 chars prefixed by "****".
 * Never expose the full token hash in API responses.
 */
function maskToken(tokenHash: string): string {
  if (tokenHash.length <= 4) {
    return "****";
  }
  return "****" + tokenHash.slice(-4);
}

export function toAssessmentLinkResponse(
  link: AssessmentLink,
): AssessmentLinkResponse {
  return {
    id: link.id,
    schoolId: link.schoolId,
    assignmentId: link.assignmentId,
    tokenPreview: maskToken(link.tokenHash),
    status: link.status,
    usageCount: link.usageCount,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    disabledAt: link.disabledAt?.toISOString() ?? null,
    regeneratedFromId: link.regeneratedFromId,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}
