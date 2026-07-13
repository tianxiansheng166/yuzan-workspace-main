import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(import.meta.dirname, "../../app/pages", path), "utf8");

describe("four-entry page truth", () => {
  it("plans uses GET plans and rejects fake consultation success", () => {
    const source = read("plans.vue");
    expect(source).toContain("gateway.plans()");
    expect(source).toContain("REAL EMPTY");
    expect(source).toContain("disabled>咨询方案");
    expect(source).not.toContain("2万");
  });

  it("admin and research expose persistence gap", () => {
    for (const path of ["admin.vue", "research.vue"]) {
      const source = read(path);
      expect(source).toContain("PERSISTENCE_PENDING");
      expect(source).toContain("disabled");
    }
  });

  it("volunteer reads three ready families", () => {
    const source = read("volunteer.vue");
    expect(source).toContain("volunteerOverview");
    expect(source).toContain("志愿者、培训与配对");
    expect(source).not.toContain("示例学生");
  });

  it("teacher tools uses provider APIs and truthful failures", () => {
    const source = read("teacher-tools/index.vue");
    expect(source).toContain("toolsOverview");
    expect(source).toContain("createMindGraphJob");
    expect(source).toContain("createTranslation");
    expect(source).toContain("PROVIDER_NOT_CONFIGURED");
  });

  it("all pages have focus, mobile and reduced-motion guardrails", () => {
    for (const path of [
      "plans.vue",
      "admin.vue",
      "research.vue",
      "volunteer.vue",
      "teacher-tools/index.vue",
    ]) {
      const source = read(path);
      expect(source).toContain("focus-visible");
      expect(source).toMatch(/@media\s*\(max-width:/);
      expect(source).toContain("prefers-reduced-motion");
    }
  });
});
