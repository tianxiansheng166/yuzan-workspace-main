import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pages = resolve(
  import.meta.dirname,
  "../../app/pages/teacher/assignments",
);
const list = readFileSync(resolve(pages, "index.vue"), "utf8");
const create = readFileSync(resolve(pages, "new.vue"), "utf8");
const detail = readFileSync(resolve(pages, "[assignmentId]/index.vue"), "utf8");

describe("assignment page metadata", () => {
  it("sets a distinct SSR-safe title for every core route", () => {
    expect(list).toContain('title: "教学任务｜语赞心声"');
    expect(create).toContain('title: "创建教学任务｜语赞心声"');
    expect(detail).toContain('title: "任务详情｜语赞心声"');
    expect(
      [list, create, detail].every((source) => source.includes("useSeoMeta")),
    ).toBe(true);
  });

  it("uses a stable detail fallback without IDs or student information", () => {
    const metadata = detail.slice(
      detail.indexOf("useSeoMeta"),
      detail.indexOf("const route"),
    );
    expect(metadata).not.toContain("assignmentId");
    expect(metadata).not.toContain("student");
    expect(metadata).not.toContain("className");
  });

  it("preserves the assignmentId route parameter", () => {
    expect(detail).toContain("route.params.assignmentId");
  });
});
