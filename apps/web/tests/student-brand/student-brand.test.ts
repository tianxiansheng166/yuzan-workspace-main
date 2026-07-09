import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  studentActionCards,
  studentStatusCopy,
} from "../../app/features/student-brand/student-brand-content";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("student brand content", () => {
  it("keeps first assessment, retest and recommended course entries unified", () => {
    expect(studentActionCards).toHaveLength(3);
    expect(studentActionCards.map((card) => card.title)).toEqual(
      expect.arrayContaining(["开始首测", "进入复测", "推荐课程"]),
    );

    const recommended = studentActionCards.find(
      (card) => card.id === "recommended-course",
    );

    expect(recommended?.statusLabel).toBe("待接入");
    expect(recommended?.availabilityNote).toContain("不伪造");
  });

  it("describes all preview states with explicit text", () => {
    expect(studentStatusCopy("preview").description).toContain("真实任务");
    expect(studentStatusCopy("loading").title).toContain("正在");
    expect(studentStatusCopy("empty").title).toContain("没有");
    expect(studentStatusCopy("offline").description).toContain("同步");
  });

  it("renders student today page with explicit state messaging", () => {
    const page = readPage("pages/student/today.vue");

    expect(page).toContain("studentActionCards");
    expect(page).toContain("待接入");
    expect(page).toContain("不伪装正式学习成果");
  });
});
