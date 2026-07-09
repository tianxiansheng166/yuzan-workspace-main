import type { AssignmentDraft } from "../types";

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export function validateAssignmentDraft(
  draft: AssignmentDraft,
): ValidationResult {
  const errors: FieldError[] = [];

  if (!draft.title.trim()) {
    errors.push({ field: "title", message: "请输入任务标题" });
  } else if (draft.title.trim().length < 2) {
    errors.push({ field: "title", message: "任务标题至少需要 2 个字符" });
  }

  if (!draft.classId) {
    errors.push({ field: "classId", message: "请选择目标班级" });
  }

  if (!draft.type) {
    errors.push({ field: "type", message: "请选择任务类型" });
  }

  if (draft.selectedContents.length === 0) {
    errors.push({ field: "contents", message: "请至少选择一项内容或测评" });
  }

  const startsAt = new Date(draft.startsAt);
  const dueAt = new Date(draft.dueAt);

  if (Number.isNaN(startsAt.getTime())) {
    errors.push({ field: "startsAt", message: "开始时间格式无效" });
  }

  if (Number.isNaN(dueAt.getTime())) {
    errors.push({ field: "dueAt", message: "截止时间格式无效" });
  }

  if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(dueAt.getTime())) {
    if (dueAt.getTime() <= startsAt.getTime()) {
      errors.push({ field: "dueAt", message: "截止时间必须晚于开始时间" });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function findFirstErrorField(errors: FieldError[]): string | null {
  return errors.length > 0 ? errors[0]!.field : null;
}
