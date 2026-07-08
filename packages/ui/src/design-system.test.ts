import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("design token static guardrails", () => {
  it("defines primitive and semantic token layers plus compatibility aliases", () => {
    const css = read("./tokens.css");

    expect(css).toContain("Primitive color tokens");
    expect(css).toContain("Primitive typography tokens");
    expect(css).toContain("Semantic background tokens");
    expect(css).toContain("Semantic action tokens");
    expect(css).toContain("Compatibility aliases");
    expect(css).toContain("--yx-bg-canvas:");
    expect(css).toContain("--yx-text-primary:");
    expect(css).toContain("--yx-action-primary-bg:");
    expect(css).toContain("--yx-color-paper:");
  });

  it("does not introduce page or role scoped token names", () => {
    const css = read("./tokens.css");

    expect(css).not.toMatch(
      /dashboard-card|course-card|student-panel|teacher-panel|hero|sidebar/i,
    );
  });

  it("keeps app.css within global baseline boundaries", () => {
    const css = read("../../../apps/web/app/assets/app.css");

    expect(css).not.toMatch(
      /hero|course-card|dashboard|sidebar|student-panel|teacher-panel/i,
    );
    expect(css).toContain("body");
    expect(css).toContain("main");
    expect(css).toContain(".page-enter-active");
  });
});
