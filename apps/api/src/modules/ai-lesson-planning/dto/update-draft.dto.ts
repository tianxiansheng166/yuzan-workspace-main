/**
 * DTO for PUT /schools/:schoolId/ai/lesson-plan-drafts/:draftId
 *
 * Updates the draft content with optimistic concurrency control.
 * The client must send the current revision number; if it doesn't
 * match the server's revision, the update is rejected (conflict).
 */
export interface UpdateDraftDto {
  /** Updated draft title. */
  title?: string;

  /** Updated draft content (full replacement). */
  content: Record<string, unknown>;

  /**
   * The revision the client is editing.
   * Must match the server's current revision for the update to succeed.
   */
  expectedRevision: number;
}
