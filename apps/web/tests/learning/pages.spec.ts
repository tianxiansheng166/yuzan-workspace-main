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
