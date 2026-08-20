import { BadRequestException } from "@nestjs/common";

const FORBIDDEN_DELIVERY_KEYS = new Set([
  "acceptedanswers",
  "answerkey",
  "correctanswer",
  "correctoption",
  "referencesanswer",
  "referenceanswer",
  "rubric",
  "scorerule",
  "scoringrule",
  "scoringspec",
  "scoringstrategy",
]);

function assertSafeValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertSafeValue(entry);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_DELIVERY_KEYS.has(key.replace(/[^a-zA-Z]/g, "").toLowerCase())) {
      throw new BadRequestException("题库题目的展示配置包含受保护的评分字段");
    }
    assertSafeValue(nestedValue);
  }
}

/**
 * Validate the student-safe half of a QuestionBankItemVersion. This fails
 * closed before a snapshot is created, so a malformed authored record cannot
 * become a student response through prompt or itemConfig.
 */
export function assertSafeQuestionDeliverySpec(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("题库题目的展示配置必须是对象");
  }
  assertSafeValue(value);
  return value as Record<string, unknown>;
}
