import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readAppFile(relativePath: string) {
  return readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf8",
  );
}

describe("app shell layout contract", () => {
  it("wraps the default layout with the product shell component", () => {
    const layout = readAppFile("layouts/default.vue");

    expect(layout).toContain("<AppShell>");
    expect(layout).toContain("<slot />");
  });

  it("provides a named mobile navigation toggle and role disclaimer", () => {
    const shell = readAppFile("components/shell/ProductShell.vue");

    expect(shell).toContain("打开导航");
    expect(shell).toContain("收起导航");
    expect(shell).toContain('href="#main"');
  });

  it("does not use glass effects and keeps one main landmark", () => {
    const shell = readAppFile("components/shell/ProductShell.vue");
    expect(shell).not.toMatch(/backdrop-filter|backdrop-blur/);
    expect(shell.match(/<main/g)).toHaveLength(1);
  });
});
