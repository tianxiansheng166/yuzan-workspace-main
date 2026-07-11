import { describe, expect, it } from "vitest";

import { DirtyStateRegistry } from "../../app/features/dirty-state/registry";

describe("dirty-state SSR safety", () => {
  it("does not access browser globals during registry construction", () => {
    const registry = new DirtyStateRegistry();

    registry.register({
      id: "ssr-entry",
      scope: "RESOURCE",
      owner: "test",
      title: "SSR Entry",
      status: "CLEAN",
      canAutoSave: true,
      canDiscard: true,
      isBlocking: true,
      save: async () => ({ status: "success" }),
      discard: async () => {},
    });

    expect(registry.has("ssr-entry")).toBe(true);
  });

  it("leave dialog is closed by default (no open request)", () => {
    const registry = new DirtyStateRegistry();

    expect(registry.getLeaveRequest()).toBeNull();
    expect(registry.hasBlockingChanges()).toBe(false);
  });

  it("does not read window or document in status helpers", () => {
    const registry = new DirtyStateRegistry();
    registry.register({
      id: "a",
      scope: "RESOURCE",
      owner: "test",
      title: "A",
      status: "DIRTY",
      canAutoSave: true,
      canDiscard: true,
      isBlocking: true,
      save: async () => ({ status: "success" }),
      discard: async () => {},
    });

    expect(registry.hasBlockingChanges()).toBe(true);
    expect(registry.getBlockingEntries()).toHaveLength(1);
  });
});
