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
  it("wraps the default layout with the shared AppShell component", () => {
    const layout = readAppFile("layouts/default.vue");

    expect(layout).toContain("<AppShell>");
    expect(layout).toContain("<slot />");
  });

  it("provides a named mobile navigation toggle and role disclaimer", () => {
    const shell = readAppFile("components/app-shell/AppShell.vue");

    expect(shell).toContain("展开角色导航");
    expect(shell).toContain("收起角色导航");
    expect(shell).toContain("不代表真实登录状态或真实权限");
  });
});
