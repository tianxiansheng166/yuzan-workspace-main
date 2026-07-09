import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(__dirname, "../../app/pages/teacher/review");

function readPage(relativePath: string) {
  return readFileSync(join(pagesDir, relativePath), "utf8");
}

describe("submission review pages static guardrails", () => {
  it("dashboard includes loading, empty, error, permission and unavailable states", () => {
    const source = readPage("index.vue");
    expect(source).toContain("state === 'loading'");
    expect(source).toContain("state === 'empty'");
    expect(source).toContain("state === 'error'");
    expect(source).toContain("state === 'permission'");
    expect(source).toContain("state === 'unavailable'");
  });

  it("dashboard keeps risk-lane framing instead of statistics cards", () => {
    const source = readPage("index.vue");
    expect(source).toContain("未完成");
    expect(source).toContain("低置信度");
    expect(source).toContain("同步异常");
    expect(source).toContain("按风险而不是按统计卡组织复核队列");
  });

  it("detail page shows original evidence, auto suggestion and teacher actions together", () => {
    const source = readPage("[reviewId]/index.vue");
    expect(source).toContain("原始证据");
    expect(source).toContain("自动结果");
    expect(source).toContain("教师结论");
    expect(source).toContain("接受");
    expect(source).toContain("退回补充");
    expect(source).toContain("线下辅导 / 排障");
  });

  it("detail page includes local demo disclaimer and editable teacher note", () => {
    const source = readPage("[reviewId]/index.vue");
    expect(source).toContain("demo / pending");
    expect(source).toContain("教师批注");
    expect(source).toContain("SUB-001");
  });

  it("pages include readable mobile breakpoints", () => {
    const listSource = readPage("index.vue");
    const detailSource = readPage("[reviewId]/index.vue");

    expect(listSource).toContain("max-width: 24.375rem");
    expect(detailSource).toContain("max-width: 24.375rem");
  });
});
