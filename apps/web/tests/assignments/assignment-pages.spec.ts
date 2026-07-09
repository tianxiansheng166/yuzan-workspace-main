import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(__dirname, "../../app/pages/teacher/assignments");

function readPage(relativePath: string) {
  return readFileSync(join(pagesDir, relativePath), "utf8");
}

describe("assignment pages static guardrails", () => {
  it("list page renders required states", () => {
    const source = readPage("index.vue");
    expect(source).toContain("state === 'loading'");
    expect(source).toContain("state === 'empty'");
    expect(source).toContain("state === 'error'");
    expect(source).toContain("state === 'unavailable'");
    expect(source).toContain("DEMO");
    expect(source).toContain("draft");
    expect(source).toContain("scheduled");
    expect(source).toContain("active");
    expect(source).toContain("completed");
  });

  it("new page renders all builder fields", () => {
    const source = readPage("new.vue");
    expect(source).toContain('label="任务标题"');
    expect(source).toContain("目标班级");
    expect(source).toContain("任务类型");
    expect(source).toContain('type="datetime-local"');
    expect(source).toContain("允许复测");
    expect(source).toContain("包含朗读练习");
    expect(source).toContain("包含书面练习");
    expect(source).toContain("完成后推荐下一课程");
    expect(source).toContain("任务预览");
    expect(source).toContain("保存草稿");
    expect(source).toContain("发布任务");
  });

  it("detail page renders required sections", () => {
    const source = readPage("[assignmentId]/index.vue");
    expect(source).toContain("state === 'loading'");
    expect(source).toContain("state === 'error'");
    expect(source).toContain("state === 'unavailable'");
    expect(source).toContain("任务概览");
    expect(source).toContain("内容结构");
    expect(source).toContain("学生完成情况");
    expect(source).toContain("复制任务");
    expect(source).toContain("停用任务");
  });

  it("pages do not access browser APIs without guards", () => {
    const listSource = readPage("index.vue");
    const newSource = readPage("new.vue");
    const detailSource = readPage("[assignmentId]/index.vue");
    for (const source of [listSource, newSource, detailSource]) {
      expect(source).not.toMatch(/\bwindow\./);
      expect(source).not.toMatch(/\bdocument\./);
      expect(source).not.toMatch(/\blocalStorage\./);
      expect(source).not.toMatch(/\bnavigator\./);
    }
  });

  it("new page supports all required assignment types", () => {
    const source = readPage("new.vue");
    expect(source).toContain('"learning"');
    expect(source).toContain('"first-assessment"');
    expect(source).toContain('"retest"');
    expect(source).toContain('"speech-practice"');
    expect(source).toContain('"written-practice"');
    expect(source).toContain('"composite"');
  });

  it("pages include 390px breakpoint", () => {
    const listSource = readPage("index.vue");
    const newSource = readPage("new.vue");
    const detailSource = readPage("[assignmentId]/index.vue");
    expect(listSource).toContain("max-width: 48rem");
    expect(newSource).toContain("max-width: 48rem");
    expect(detailSource).toContain("max-width: 24.375rem");
  });

  it("pages mark demo data and do not claim real backend", () => {
    const newSource = readPage("new.vue");
    expect(newSource).toContain("DEMO 模式");
    expect(newSource).toContain("ASN-001");
    expect(newSource).toContain("不会真正下发");
  });
});
