export type TranslationDirection = "zh-to-bo" | "bo-to-zh";

export interface TranslationRequest {
  text: string;
  direction: TranslationDirection;
}

export interface TranslationResult {
  source: string;
  target: string;
  direction: TranslationDirection;
  isLocalPhrase: boolean;
  /** API 接入前为空；接入后由网关填充模型版本与置信度。 */
  meta?: {
    model?: string;
    confidence?: number;
  };
}

export interface TranslationHistoryItem extends TranslationResult {
  id: string;
  createdAt: number;
}
