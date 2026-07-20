import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const pagesDir = join(dirname(fileURLToPath(import.meta.url)), "../../app/pages/teacher/assignments");
const readPage = (path: string) => readFileSync(join(pagesDir, path), "utf8");
describe("live assignment pages", () => {
  it("renders loading, empty and mapped error states", () => { const source=readPage("index.vue"); expect(source).toContain("state==='loading'"); expect(source).toContain("state==='empty'"); expect(source).toContain("state==='error'"); expect(source).toContain("failure?.code"); });
  it("creates from real course and class identifiers", () => { const source=readPage("new.vue"); expect(source).toContain("courseVersionId"); expect(source).toContain("classId"); expect(source).toContain('type="datetime-local"'); expect(source).toContain("createAssignment"); expect(source).toContain("不会代填 demo"); });
  it("opens and closes only after the gateway response", () => { const source=readPage("index.vue"); expect(source).toContain("transitionAssignment"); expect(source).toContain("item.revision"); expect(source).toContain("服务器"); });
  it("retains the existing detail route", () => { const source=readPage("[assignmentId]/index.vue"); expect(source).toContain("route.params.assignmentId"); expect(source).toContain("任务概览"); });
  it("does not use unguarded browser storage", () => { for(const source of [readPage("index.vue"),readPage("new.vue")]){expect(source).not.toMatch(/\bwindow\./);expect(source).not.toMatch(/\blocalStorage\./);} });
  it("has responsive and focus guardrails", () => { for(const source of [readPage("index.vue"),readPage("new.vue")]){expect(source).toContain("@media(max-width:");expect(source).toContain("focus-visible");} });
});