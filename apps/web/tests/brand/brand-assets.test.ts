import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { brandAssetMetadata } from "../../app/assets/brand/asset-metadata";
import {
  brandEntryLinks,
  brandPositioning,
  brandProductName,
  brandPrinciples,
  brandValues,
} from "../../app/features/brand/brand-content";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("brand assets and copy", () => {
  it("keeps all asset metadata local and original", () => {
    expect(brandAssetMetadata.length).toBeGreaterThan(0);

    for (const asset of brandAssetMetadata) {
      expect(asset.source).toBe("local-original");
      expect(asset.description).not.toMatch(/https?:\/\//);
    }
  });

  it("defines the required home entry links", () => {
    expect(brandEntryLinks.map((entry) => entry.label)).toEqual(
      expect.arrayContaining(["开始 AI 测评", "查看学生今日", "教师工作台"]),
    );
  });

  it("describes core values without fake metrics or endorsements", () => {
    expect(brandProductName).toBe("语赞心声");
    expect(brandPositioning).toContain("弱网");
    expect(brandValues).toHaveLength(4);

    for (const item of brandValues) {
      expect(item.summary).not.toMatch(
        /合作学校|用户数|获奖|认证机构|权威背书/,
      );
      expect(item.proofLabel).toBeTruthy();
    }
  });

  it("keeps home page copy sourced from reusable brand content", () => {
    const home = readPage("pages/index.vue");

    expect(home).toContain("brandEntryLinks");
    expect(home).toContain("brandValues");
    expect(home).toContain("brandPrinciples");
    expect(brandValues.map((value) => value.title)).toEqual(
      expect.arrayContaining([
        "AI 测评",
        "学生成长",
        "教师工具",
        "培训与公益支持",
      ]),
    );
  });
});
