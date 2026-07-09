import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("IconGallery design system page", () => {
  it("exists as a design system showcase route", () => {
    const page = readPage("pages/design/icons.vue");

    expect(page).toContain('title: "图标系统｜语赞心声"');
    expect(page).toContain("IconGallery");
  });

  it("declares itself as a non-business showcase page", () => {
    const gallery = readPage(
      "features/icon-gallery/components/IconGallery.vue",
    );

    expect(gallery).toContain("核心图标系统");
    expect(gallery).toContain("设计系统展示页");
    expect(gallery).toContain("非正式业务入口");
  });

  it("uses YxIcon for every registered icon", () => {
    const gallery = readPage(
      "features/icon-gallery/components/IconGallery.vue",
    );

    expect(gallery).toContain("ICON_NAMES");
    expect(gallery).toContain("YxIcon");
    expect(gallery).toContain(':name="name"');
  });

  it("does not use emoji in the page copy", () => {
    const gallery = readPage(
      "features/icon-gallery/components/IconGallery.vue",
    );
    const emojiPattern =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

    expect(gallery).not.toMatch(emojiPattern);
  });
});
