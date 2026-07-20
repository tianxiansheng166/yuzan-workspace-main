import { describe, expect, it } from "vitest";
import { useAssignmentBuilder } from "../../app/features/assignment-builder/composables/useAssignmentBuilder";

describe("useAssignmentBuilder", () => {
  it("allows editing for teacher role", () => {
    const builder = useAssignmentBuilder("teacher");
    expect(builder.canEdit).toBe(true);
  });

  it("disallows editing for unknown role", () => {
    const builder = useAssignmentBuilder("unknown");
    expect(builder.canEdit).toBe(false);
  });

  it("rejects save draft for unknown role", async () => {
    const builder = useAssignmentBuilder("unknown");
    const result = await builder.saveDraft();
    expect(result).toBeNull();
    expect(builder.fieldError("role")).toBe("当前角色没有保存草稿的权限");
  });

  it("rejects publish for unknown role", async () => {
    const builder = useAssignmentBuilder("unknown");
    const result = await builder.publish();
    expect(result).toBeNull();
    expect(builder.fieldError("role")).toBe("当前角色没有发布任务的权限");
  });

  it("validates and saves draft for teacher", async () => {
    const builder = useAssignmentBuilder("teacher");
    builder.state.title = "草稿标题";
    builder.state.classId = "cls-demo-01";
    builder.state.type = "learning";
    builder.state.selectedContents = [
      { id: "c1", kind: "course", title: "课程" },
    ];
    builder.state.startsAt = "2026-07-01T08:00";
    builder.state.dueAt = "2026-07-15T23:59";

    const result = await builder.saveDraft();
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.demo).toBe(true);
  });

  it("returns demo unavailable on publish", async () => {
    const builder = useAssignmentBuilder("teacher");
    builder.state.title = "发布标题";
    builder.state.classId = "cls-demo-01";
    builder.state.type = "learning";
    builder.state.selectedContents = [
      { id: "c1", kind: "course", title: "课程" },
    ];
    builder.state.startsAt = "2026-07-01T08:00";
    builder.state.dueAt = "2026-07-15T23:59";

    const result = await builder.publish();
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.demo).toBe(true);
    expect(result!.message).toContain("ASN-001");
  });

  it("reports validation errors for invalid draft", async () => {
    const builder = useAssignmentBuilder("teacher");
    builder.state.title = "";
    builder.state.classId = "";
    builder.state.selectedContents = [];
    builder.state.startsAt = "2026-07-15T08:00";
    builder.state.dueAt = "2026-07-01T08:00";

    const result = await builder.saveDraft();
    expect(result).toBeNull();
    expect(builder.fieldError("title")).toBe("请输入任务标题");
    expect(builder.fieldError("classId")).toBe("请选择目标班级");
    expect(builder.fieldError("contents")).toBe("请至少选择一项内容或测评");
    expect(builder.fieldError("dueAt")).toBe("截止时间必须晚于开始时间");
    expect(builder.firstErrorField.value).toBe("title");
  });

  it("adds and removes selected contents", () => {
    const builder = useAssignmentBuilder("teacher");
    builder.addContent("course", "古诗精读");
    expect(builder.state.selectedContents).toHaveLength(1);
    expect(builder.state.selectedContents[0].title).toBe("古诗精读");

    const id = builder.state.selectedContents[0].id;
    builder.removeContent(id);
    expect(builder.state.selectedContents).toHaveLength(0);
  });
});
