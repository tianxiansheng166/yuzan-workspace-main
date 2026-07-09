import { describe, expect, it } from "vitest";
import type { IconName } from "./icon-types";
import { ICON_NAMES } from "./icon-types";
import { ICON_REGISTRY } from "./icons";

describe("core icon system", () => {
  it("includes the required semantic icon names", () => {
    const required = [
      "assessment",
      "reading",
      "writing",
      "report",
      "history",
      "student",
      "teacher",
      "tools",
      "training",
      "translation",
      "product",
      "settings",
      "link",
      "copy",
      "warning",
      "pending",
      "unavailable",
      "demo",
      "success",
      "error",
    ];

    for (const name of required) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it("does not allow empty svg paths", () => {
    for (const name of ICON_NAMES) {
      const icon = ICON_REGISTRY[name];
      expect(icon, `icon ${name} must be registered`).toBeDefined();
      expect(icon.paths.length, `icon ${name} must have paths`).toBeGreaterThan(
        0,
      );
      for (const path of icon.paths) {
        expect(
          path.trim().length,
          `icon ${name} must not have empty paths`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("has unique icon names", () => {
    const unique = new Set(ICON_NAMES);
    expect(unique.size).toBe(ICON_NAMES.length);
  });

  it("includes status icons", () => {
    const statusIcons: IconName[] = [
      "warning",
      "pending",
      "unavailable",
      "success",
      "error",
      "demo",
    ];
    for (const name of statusIcons) {
      expect(ICON_NAMES).toContain(name);
      expect(ICON_REGISTRY[name]).toBeDefined();
    }
  });

  it("does not use emoji in icon paths", () => {
    const emojiPattern =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

    for (const name of ICON_NAMES) {
      const joined = ICON_REGISTRY[name].paths.join(" ");
      expect(joined, `icon ${name} must not contain emoji`).not.toMatch(
        emojiPattern,
      );
    }
  });
});
