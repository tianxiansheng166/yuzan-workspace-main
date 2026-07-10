import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(
  resolve(import.meta.dirname, "../../app/pages/index.vue"),
  "utf8",
);

describe("product home visual contract", () => {
  it("provides one correct h1 and explicit non-production status language", () => {
    expect(home.match(/<h1/g)).toHaveLength(1);
    expect(home).toContain("开发预览");
    expect(home).toContain("pending");
    expect(home).toContain("unavailable");
  });

  it("supports reduced motion and the generated learning terrain", () => {
    expect(home).toContain("prefers-reduced-motion: reduce");
    expect(home).toContain("/art/acc-ui-001-learning-terrain.svg");
  });
});
