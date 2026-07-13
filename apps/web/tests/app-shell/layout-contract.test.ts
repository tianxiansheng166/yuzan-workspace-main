import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) =>
  readFileSync(resolve(import.meta.dirname, "../../app", path), "utf8");
describe("app shell layout", () => {
  it("wraps default layout", () => {
    const source = read("layouts/default.vue");
    expect(source).toContain("<AppShell>");
    expect(source).toContain("<slot />");
  });
  it("exposes four primary entries and account actions", () => {
    const source = read("components/app-shell/AppShell.vue");
    for (const route of ["/", "/student/today", "/teacher", "/volunteer"]) {
      expect(source).toMatch(
        new RegExp(`to:\\s*["']${route.replace("/", "\\/")}["']`),
      );
    }
    expect(source).toContain('to="/plans"');
    expect(source).toContain('to="/select-school"');
    expect(source).toContain('to="/login"');
  });
  it("has skip, mobile and focus guardrails", () => {
    const source = read("components/app-shell/AppShell.vue");
    expect(source).toContain('href="#main"');
    expect(source).toContain("展开导航");
    expect(source).toContain("focus-visible");
  });
});
