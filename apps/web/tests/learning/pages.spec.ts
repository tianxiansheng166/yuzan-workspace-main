import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../app");
const today = readFileSync(resolve(root, "pages/student/today.vue"), "utf8");
const player = readFileSync(
  resolve(root, "pages/student/learning/[activityId].vue"),
  "utf8",
);
const stepper = readFileSync(
  resolve(root, "features/learning-player/components/PlayerStepper.vue"),
  "utf8",
);

describe("learning page guardrails", () => {
  it("relies on the application shell as the only main landmark", () => {
    expect(today).not.toMatch(/<\/?main(?:\s|>)/);
    expect(player).not.toMatch(/<\/?main(?:\s|>)/);
    expect(today).not.toContain('role="main"');
    expect(player).not.toContain('role="main"');
  });
  it("keeps one clear page h1 in each page source", () => {
    expect(today.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(player.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(today).toContain('aria-labelledby="today-page-title"');
    expect(player).toContain('aria-labelledby="player-page-title"');
  });
  it("provides stable SSR-safe titles", () => {
    expect(today).toContain('useHead({ title: "今日学习｜语赞心声" })');
    expect(player).toContain('useHead({ title: "学习活动｜语赞心声" })');
    expect(player).not.toMatch(/useHead\([^)]*activityId/s);
    expect(player).not.toMatch(/title:\s*[^\n]*(学生|姓名|demo)/i);
    expect(player).not.toContain("document.title");
    expect(player).not.toContain("window.document");
  });
  it("uses the same stable title for unknown activities", () => {
    const titleLine = player
      .split("\n")
      .find((line) => line.includes("useHead({ title:"));
    expect(titleLine).toBe('useHead({ title: "学习活动｜语赞心声" });');
    expect(titleLine).not.toContain("activityId");
  });
  it("keeps the existing assessment entry", () =>
    expect(today).toContain('to="/assessment"'));
  it("uses the activityId route", () =>
    expect(player).toContain("route.params.activityId"));
  it("has SSR-safe browser boundaries", () => {
    expect(player).toContain("import.meta.client");
    expect(player).not.toContain("localStorage");
  });
  it("supports 390px and reduced motion", () => {
    expect(today).toContain("max-width: 40rem");
    expect(player).toContain("prefers-reduced-motion");
  });
  it("provides keyboard and aria guardrails", () => {
    expect(stepper).toContain("aria-current");
    expect(player).toContain("focus-visible");
    expect(player).toContain("aria-describedby");
  });
  it("does not claim fake scores or synced progress", () => {
    expect(player).toContain("不会伪造录音");
    expect(player).toContain("不会显示 synced");
  });
});
