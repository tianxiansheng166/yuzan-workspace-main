import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("integration entry points", () => {
  it("default layout links to all MVP top-level routes", () => {
    const layout = readPage("layouts/default.vue");

    expect(layout).toContain('to: "/assessment"');
    expect(layout).toContain('to: "/student/today"');
    expect(layout).toContain('to: "/teacher"');
    expect(layout).toContain('to: "/teacher-tools"');
    expect(layout).toContain('to: "/training"');
    expect(layout).toContain('to: "/products"');
  });

  it("home page links to AI assessment, teacher tools and product plans", () => {
    const home = readPage("pages/index.vue");

    expect(home).toContain('to="/assessment"');
    expect(home).toContain('to="/teacher-tools"');
    expect(home).toContain('to="/products"');
  });

  it("student today page links to first assessment, retest and recommended courses", () => {
    const today = readPage("pages/student/today.vue");

    expect(today).toContain('to="/assessment"');
    expect(today).toContain("首测");
    expect(today).toContain("复测");
    expect(today).toContain("推荐课程");
  });

  it("teacher home links to assessment tasks, reports, MindMate, MindGraph and translation", () => {
    const teacher = readPage("pages/teacher/index.vue");

    expect(teacher).toContain('to: "/teacher/assessments"');
    expect(teacher).toContain('to: "/teacher-tools/mindmate"');
    expect(teacher).toContain('to: "/teacher-tools/mindgraph"');
    expect(teacher).toContain('to: "/tools/tibetan-translation"');
  });
});
