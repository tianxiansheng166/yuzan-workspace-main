import type { WrittenAnswer } from "../domain/assessment.types.js";

export const WRITTEN_ANSWER_REPOSITORY = Symbol("WRITTEN_ANSWER_REPOSITORY");

export interface SaveWrittenAnswerData {
  readonly itemId: string;
  readonly content: Record<string, unknown>;
  readonly wordCount: number;
  readonly charCount: number;
}

export interface WrittenAnswerRepositoryPort {
  findByItemId(itemId: string): Promise<WrittenAnswer | null>;
  findBySessionId(sessionId: string): Promise<WrittenAnswer[]>;
  upsert(data: SaveWrittenAnswerData): Promise<WrittenAnswer>;
  finalize(itemId: string): Promise<WrittenAnswer>;
}
