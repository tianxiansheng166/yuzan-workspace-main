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

  it("provides mobile navigation and authenticated account actions", () => {
    const shell = readAppFile("components/app-shell/AppShell.vue");

    expect(shell).toContain("展开角色导航");
    expect(shell).toContain("收起角色导航");
    expect(shell).toContain("切换学校");
    expect(shell).toContain("退出登录");
    expect(shell).toContain("activeSchool.schoolName");
  });
});
