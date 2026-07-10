import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pages = resolve(import.meta.dirname, "../../app/pages/teacher/review");
const list = readFileSync(resolve(pages, "index.vue"), "utf8");
const detail = readFileSync(resolve(pages, "[submissionId]/index.vue"), "utf8");
const feedback = readFileSync(
  resolve(pages, "[submissionId]/feedback.vue"),
  "utf8",
);

describe("submission review page metadata", () => {
  it("sets a distinct SSR-safe title for every core route", () => {
    expect(list).toContain('title: "提交复核｜语赞心声"');
    expect(detail).toContain('title: "提交详情｜语赞心声"');
    expect(feedback).toContain('title: "教师反馈｜语赞心声"');
    expect(
      [list, detail, feedback].every((source) => source.includes("useSeoMeta")),
    ).toBe(true);
  });

  it("keeps dynamic titles free of IDs and student information", () => {
    for (const source of [detail, feedback]) {
      const metadata = source.slice(
        source.indexOf("useSeoMeta"),
        source.indexOf("const route"),
      );
      expect(metadata).not.toContain("submissionId");
      expect(metadata).not.toContain("studentDisplayName");
      expect(metadata).not.toContain("className");
    }
  });

  it("preserves the submissionId route parameter", () => {
    expect(detail).toContain("route.params.submissionId");
    expect(feedback).toContain("route.params.submissionId");
  });
});
