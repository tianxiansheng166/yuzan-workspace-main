import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { roleNavigationGroups } from "../../app/features/role-navigation/role-navigation.config";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("integration entry points", () => {
  it("default layout delegates top-level navigation to the shared app shell", () => {
    const layout = readPage("layouts/default.vue");

    expect(layout).toContain("<AppShell>");
  });

  it("role navigation config links to all current top-level routes required by the shell", () => {
    const links = roleNavigationGroups.flatMap((group) =>
      group.items.map((item) => item.to),
    );

    expect(links).toEqual(
      expect.arrayContaining([
        "/assessment",
        "/assessment/history",
        "/student/today",
        "/teacher",
        "/teacher/assessments",
        "/teacher/students/demo/assessment-reports",
        "/teacher-tools",
        "/training",
        "/products",
        "/tools/tibetan-translation",
      ]),
    );
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
