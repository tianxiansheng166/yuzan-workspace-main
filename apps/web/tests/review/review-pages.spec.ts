import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reviewPagesDir = join(__dirname, "../../app/pages/teacher/review");
const reviewComponentsDir = join(
  __dirname,
  "../../app/features/submission-review/components",
);

function readReviewPage(relativePath: string) {
  return readFileSync(join(reviewPagesDir, relativePath), "utf8");
}

function readReviewComponent(relativePath: string) {
  return readFileSync(join(reviewComponentsDir, relativePath), "utf8");
}

describe("submission review pages static guardrails", () => {
  it("list page includes loading, empty, error, permission and unavailable states", () => {
    const source = readReviewPage("index.vue");
    expect(source).toContain("state === 'loading'");
    expect(source).toContain("state === 'empty'");
    expect(source).toContain("state === 'error'");
    expect(source).toContain("state === 'permission'");
    expect(source).toContain("state === 'unavailable'");
  });

  it("list page includes class, task and status filters", () => {
    const source = [
      readReviewPage("index.vue"),
      readReviewComponent("ReviewFilterBar.vue"),
    ].join("\n");
    expect(source).toContain("按班级筛选");
    expect(source).toContain("按任务类型筛选");
    expect(source).toContain("按提交时间排序");
    expect(source).toContain("按状态筛选");
  });

  it("detail page includes student info, task description and recording metadata", () => {
    const source = readReviewPage("[submissionId]/index.vue");
    expect(source).toContain("学生与班级基础信息");
    expect(source).toContain("任务说明");
    expect(source).toContain("朗读提交元数据");
  });

  it("detail page includes writing content, learning evidence and retest linkage", () => {
    const source = readReviewPage("[submissionId]/index.vue");
    expect(source).toContain("书面练习内容");
    expect(source).toContain("学习过程证据");
    expect(source).toContain("首测 / 复测关联");
  });

  it("feedback page includes teacher comment, redo and retest fields", () => {
    const source = [
      readReviewPage("[submissionId]/feedback.vue"),
      readReviewComponent("ReviewFeedbackForm.vue"),
    ].join("\n");
    expect(source).toContain("做得好的地方");
    expect(source).toContain("当前最重要的问题");
    expect(source).toContain("一个明确的下一步动作");
    expect(source).toContain("退回修改原因");
    expect(source).toContain("复测目标");
    expect(source).toContain("是否需要重做");
    expect(source).toContain("是否建议复测");
    expect(source).toContain("保存草稿");
    expect(source).toContain("提交反馈");
  });

  it("pages do not directly access browser-only APIs", () => {
    const files = [
      readReviewPage("index.vue"),
      readReviewPage("[submissionId]/index.vue"),
      readReviewPage("[submissionId]/feedback.vue"),
    ].join("\n");
    expect(files).not.toContain("window.");
    expect(files).not.toContain("localStorage");
    expect(files).not.toContain("navigator.");
  });

  it("pages keep 390px guardrails", () => {
    const files = [
      readReviewPage("index.vue"),
      readReviewPage("[submissionId]/index.vue"),
      readReviewPage("[submissionId]/feedback.vue"),
    ].join("\n");
    expect(files).toContain("max-width: 24.375rem");
  });
});
