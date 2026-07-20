import type { FeedbackValidationResult, TeacherFeedbackDraft } from "../types";

const structuredFields = [
  "strengths",
  "priorityIssue",
  "nextAction",
  "sectionFeedback",
  "summary",
] as const;

export function validateTeacherFeedbackDraft(
  draft: TeacherFeedbackDraft,
): FeedbackValidationResult {
  const issues: FeedbackValidationResult["issues"] = [];

  if (structuredFields.every((field) => draft[field].trim().length === 0)) {
    issues.push({
      field: "summary",
      message: "反馈不能全部为空，请至少形成一条具体判断。",
    });
  }

  if (draft.nextAction.trim().length < 6) {
    issues.push({
      field: "nextAction",
      message: "请给出至少 6 个字符的明确下一步动作。",
    });
  }

  for (const field of structuredFields) {
    if (draft[field].length > 240) {
      issues.push({
        field,
        message: "单项反馈请控制在 240 个字符以内，避免超长无结构文本。",
      });
    }
  }

  if (draft.focusAreas.length === 0) {
    issues.push({
      field: "focusAreas",
      message: "请至少标记一个重点关注项，说明教师为什么这样处理。",
    });
  }

  if (draft.needsRedo && draft.reviewStatus === "reviewed") {
    issues.push({
      field: "reviewStatus",
      message: "要求重做时，复核状态不能仍为“已复核”。",
    });
  }

  if (draft.needsRedo && draft.returnReason.trim().length < 6) {
    issues.push({
      field: "returnReason",
      message: "退回修改时必须说明具体原因。",
    });
  }

  if (draft.retestRecommended && draft.retestGoal.trim().length < 6) {
    issues.push({
      field: "retestGoal",
      message: "建议复测时必须说明本次复测目标。",
    });
  }

  return { valid: issues.length === 0, issues };
}
