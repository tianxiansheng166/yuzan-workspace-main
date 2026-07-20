import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pages = resolve(import.meta.dirname, "../../app/pages/studio");
const dashboard = readFileSync(resolve(pages, "index.vue"), "utf8");
const detail = readFileSync(resolve(pages, "[draftId].vue"), "utf8");

describe("curriculum studio page metadata", () => {
  it("sets distinct SSR-safe titles", () => {
    expect(dashboard).toContain('title: "课程工作台｜语赞心声"');
    expect(detail).toContain('title: "课程版本｜语赞心声"');
    expect(
      [dashboard, detail].every((source) => source.includes("useSeoMeta")),
    ).toBe(true);
  });

  it("keeps the detail title independent from route data and private content", () => {
    const metadata = detail.slice(
      detail.indexOf("useSeoMeta"),
      detail.indexOf("const route"),
    );
    expect(metadata).not.toContain("draftId");
    expect(metadata).not.toContain("result");
    expect(metadata).not.toContain("student");
  });

  it("preserves the draftId route parameter", () => {
    expect(detail).toContain("route.params.draftId");
  });
});
