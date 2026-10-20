export interface QuestionBankDraftResponse {
  readonly questionVersionId: string;
  readonly itemId: string;
  readonly version: number;
  readonly revision: number;
  readonly status: "DRAFT" | "PUBLISHED" | "RETIRED";
  readonly reviewStatus: "NOT_SUBMITTED" | "NOT_TRACKED";
  readonly publishedAt: string | null;
  readonly title: string;
  readonly prompt: string;
  readonly itemType: string;
  readonly domain: string | null;
  readonly questionType: string | null;
  readonly gradeBand: string | null;
  readonly level: string | null;
  readonly difficulty: string | null;
  readonly abilityCategory: string | null;
  readonly options: readonly { readonly key: string; readonly text: string }[];
  readonly correctOption: string | null;
  readonly acceptedAnswers: readonly string[];
  readonly maxScore: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
