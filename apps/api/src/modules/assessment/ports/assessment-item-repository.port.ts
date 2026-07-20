import type { AssessmentItem, AssessmentItemStatus } from "../domain/assessment.types.js";

export const ASSESSMENT_ITEM_REPOSITORY = Symbol("ASSESSMENT_ITEM_REPOSITORY");

export interface CreateAssessmentItemData {
  readonly sessionId: string;
  readonly questionId?: string;
  readonly prompt: Record<string, unknown>;
  readonly itemType: string;
  readonly sortOrder: number;
  readonly maxScore?: number;
}

export interface AssessmentItemRepositoryPort {
  findBySessionId(sessionId: string): Promise<AssessmentItem[]>;
  findById(itemId: string): Promise<AssessmentItem | null>;
  findByIdAndSession(itemId: string, sessionId: string): Promise<AssessmentItem | null>;
  createMany(items: CreateAssessmentItemData[]): Promise<AssessmentItem[]>;
  updateRecordingId(itemId: string, recordingId: string): Promise<AssessmentItem>;
  updateStatus(itemId: string, status: AssessmentItemStatus): Promise<AssessmentItem>;
  updateScore(itemId: string, scoredScore: number, autoResult?: Record<string, unknown>): Promise<AssessmentItem>;
}
