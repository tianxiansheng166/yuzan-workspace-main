import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productRouteRegistry } from "../../app/routing/product-route-registry";

const readPage = (path: string) =>
  readFileSync(resolve(import.meta.dirname, "../../app", path), "utf8");

describe("integration entry points", () => {
  it("default layout delegates navigation to AppShell", () =>
    expect(readPage("layouts/default.vue")).toContain("<AppShell>"));
  it("uses the registry as the only navigation fact source", () => {
    const shell = readPage("components/app-shell/AppShell.vue");
    expect(shell).toContain("navigationRoutesForRole");
    expect(shell).not.toContain("roleNavigationGroups");
  });
  it("home points to the canonical plans page", () => {
    const home = readPage("pages/index.vue");
    expect(home).toContain('to="/plans"');
    expect(home).not.toContain('to="/products"');
  });
  it("registers all four product ports", () => {
    expect(new Set(productRouteRegistry.map((entry) => entry.port))).toEqual(
      new Set(["PUBLIC", "STUDENT", "TEACHER", "VOLUNTEER", "ADMIN"]),
    );
  });
  it("teacher tools and volunteer training have real upstream links", () => {
    const tools = readPage("pages/teacher-tools/index.vue");
    for (const path of [
      "/teacher-tools/mindmate",
      "/teacher-tools/mindgraph",
      "/tools/tibetan-translation",
    ])
      expect(tools).toContain(path);
    expect(readPage("pages/volunteer.vue")).toContain(
      'to="/training/volunteer"',
    );
    expect(readPage("pages/training/volunteer.vue")).toContain(
      'to="/volunteer"',
    );
  });
});
