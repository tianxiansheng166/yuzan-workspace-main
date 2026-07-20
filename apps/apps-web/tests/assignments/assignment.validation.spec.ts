import { describe, expect, it } from "vitest";
import {
  findFirstErrorField,
  validateAssignmentDraft,
} from "../../app/features/assignment-builder/validation/assignment.validation";
import type { AssignmentDraft } from "../../app/features/assignment-builder/types";

function makeDraft(overrides: Partial<AssignmentDraft> = {}): AssignmentDraft {
  return {
    classId: "cls-demo-01",
    type: "learning",
    title: "有效标题",
    description: "",
    selectedContents: [{ id: "c1", kind: "course", title: "课程" }],
    startsAt: "2026-07-01T08:00",
    dueAt: "2026-07-15T23:59",
    allowRetest: false,
    includeSpeech: false,
    includeWritten: false,
    recommendNextCourse: false,
    ...overrides,
  };
}

describe("assignment validation", () => {
  it("passes for a valid draft", () => {
    const result = validateAssignmentDraft(makeDraft());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("requires title", () => {
    const result = validateAssignmentDraft(makeDraft({ title: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "title",
      message: "请输入任务标题",
    });
  });

  it("requires classId", () => {
    const result = validateAssignmentDraft(makeDraft({ classId: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "classId",
      message: "请选择目标班级",
    });
  });

  it("requires selected contents", () => {
    const result = validateAssignmentDraft(makeDraft({ selectedContents: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "contents",
      message: "请至少选择一项内容或测评",
    });
  });

  it("rejects dueAt before startsAt", () => {
    const result = validateAssignmentDraft(
      makeDraft({
        startsAt: "2026-07-15T08:00",
        dueAt: "2026-07-01T08:00",
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "dueAt",
      message: "截止时间必须晚于开始时间",
    });
  });

  it("rejects equal start and due times", () => {
    const result = validateAssignmentDraft(
      makeDraft({
        startsAt: "2026-07-15T08:00",
        dueAt: "2026-07-15T08:00",
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "dueAt",
      message: "截止时间必须晚于开始时间",
    });
  });

  it("rejects invalid datetime strings", () => {
    const result = validateAssignmentDraft(
      makeDraft({
        startsAt: "not-a-date",
        dueAt: "also-not-a-date",
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "startsAt",
      message: "开始时间格式无效",
    });
    expect(result.errors).toContainEqual({
      field: "dueAt",
      message: "截止时间格式无效",
    });
  });

  it("finds first error field", () => {
    const errors = [
      { field: "title", message: "请输入任务标题" },
      { field: "dueAt", message: "截止时间必须晚于开始时间" },
    ];
    expect(findFirstErrorField(errors)).toBe("title");
  });
});
