import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { navigationRoutesForRole } from "../../app/routing/product-route-registry";
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
    expect(source).toContain("navigationRoutesForRole");
    expect(source).toContain('v-for="entry in entries"');
    expect(
      navigationRoutesForRole("STUDENT").map((entry) => entry.path),
    ).toContain("/student/today");
    expect(
      navigationRoutesForRole("TEACHER").map((entry) => entry.path),
    ).toContain("/teacher");
    expect(
      navigationRoutesForRole("VOLUNTEER").map((entry) => entry.path),
    ).toContain("/volunteer");
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
