import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(__dirname, "../../app/pages/teacher/classes");

function readPage(relativePath: string) {
  return readFileSync(join(pagesDir, relativePath), "utf8");
}

describe("class pages static guardrails", () => {
  it("list page renders loading, empty, error and unavailable states", () => {
    const source = readPage("index.vue");
    expect(source).toContain("state === 'loading'");
    expect(source).toContain("state === 'empty'");
    expect(source).toContain("state === 'error'");
    expect(source).toContain("state === 'unavailable'");
  });

  it("detail page renders loading, empty, error and unavailable states", () => {
    const source = readPage("[classId]/index.vue");
    expect(source).toContain("state === 'loading'");
    expect(source).toContain("state === 'empty'");
    expect(source).toContain("state === 'error'");
    expect(source).toContain("state === 'unavailable'");
  });

  it("list page disables management actions for unknown role", () => {
    const source = readPage("index.vue");
    expect(source).toContain("canManage");
    expect(source).toContain(':disabled="!canManage"');
  });

  it("detail page marks demo students and disables backend actions", () => {
    const source = readPage("[classId]/index.vue");
    expect(source).toContain("isDemo");
    expect(source).toContain("DEMO");
    expect(source).toContain("canManage");
    expect(source).toContain('disabled title="查看学生报告尚未接入后端"');
    expect(source).toContain('disabled title="移除学生尚未接入后端"');
  });

  it("detail page links to existing assessment and report routes without creating shared pages", () => {
    const source = readPage("[classId]/index.vue");
    expect(source).toContain("/assessments/");
    expect(source).toContain("/reports");
  });

  it("list page includes a readable 390px breakpoint", () => {
    const source = readPage("index.vue");
    expect(source).toContain("max-width: 24.375rem");
  });

  it("detail page includes a readable 390px breakpoint", () => {
    const source = readPage("[classId]/index.vue");
    expect(source).toContain("max-width: 24.375rem");
  });

  it("pages do not claim real backend data", () => {
    const listSource = readPage("index.vue");
    const detailSource = readPage("[classId]/index.vue");
    expect(listSource).toContain("demo");
    expect(detailSource).toContain("demo");
    expect(detailSource).toContain("pending");
    expect(detailSource).toContain("unavailable");
  });
});
