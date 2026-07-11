import { describe, expect, it } from "vitest";

import { DirtyStateRegistry } from "../../app/features/dirty-state/registry";

describe("DirtyStateRegistry", () => {
  function createRegistry() {
    return new DirtyStateRegistry();
  }

  function createEntryInput(overrides: Partial<{
    id: string;
    scope: "GLOBAL" | "SCHOOL" | "ROUTE" | "RESOURCE";
    owner: string;
    status: import("../../app/features/dirty-state/types").DirtyStatus;
    canAutoSave: boolean;
    canDiscard: boolean;
    isBlocking: boolean;
    saveResult: import("../../app/features/dirty-state/types").DirtyStateEntrySaveResult;
    save: () => Promise<import("../../app/features/dirty-state/types").DirtyStateEntrySaveResult>;
    discard: () => Promise<void>;
    metadata: Record<string, unknown>;
  }> = {}) {
    return {
      id: overrides.id ?? "entry-1",
      scope: overrides.scope ?? "RESOURCE",
      owner: overrides.owner ?? "test-owner",
      title: "Test Entry",
      status: overrides.status ?? "CLEAN",
      canAutoSave: overrides.canAutoSave ?? true,
      canDiscard: overrides.canDiscard ?? true,
      isBlocking: overrides.isBlocking ?? true,
      save:
        overrides.save ??
        (async () => overrides.saveResult ?? { status: "success" as const }),
      discard: overrides.discard ?? (async () => {}),
      metadata: overrides.metadata ?? { resourceType: "test", resourceId: "r1" },
    };
  }

  it("registers an entry and returns it", () => {
    const registry = createRegistry();
    const entry = registry.register(createEntryInput({ id: "a" }));

    expect(entry.id).toBe("a");
    expect(registry.has("a")).toBe(true);
    expect(registry.get("a")?.status).toBe("CLEAN");
  });

  it("throws when registering a duplicate id", () => {
    const registry = createRegistry();
    registry.register(createEntryInput({ id: "dup" }));

    expect(() => registry.register(createEntryInput({ id: "dup" }))).toThrow(
      "already registered",
    );
  });

  it("unregisters an entry", () => {
    const registry = createRegistry();
    registry.register(createEntryInput({ id: "a" }));
    registry.unregister("a");

    expect(registry.has("a")).toBe(false);
    expect(registry.getAll()).toHaveLength(0);
  });

  it("marks an entry dirty and clean", () => {
    const registry = createRegistry();
    registry.register(createEntryInput({ id: "a", status: "CLEAN" }));

    registry.markDirty("a");
    expect(registry.get("a")?.status).toBe("DIRTY");

    registry.markClean("a");
    expect(registry.get("a")?.status).toBe("CLEAN");
  });

  it("updates status with timestamp", async () => {
    const registry = createRegistry();
    registry.register(createEntryInput({ id: "a", status: "CLEAN" }));
    const before = registry.get("a")!.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    registry.updateStatus("a", "SAVING");

    expect(registry.get("a")?.status).toBe("SAVING");
    expect(registry.get("a")!.updatedAt).toBeGreaterThan(before);
  });

  it("tracks multiple entries and blocking state", () => {
    const registry = createRegistry();
    registry.register(createEntryInput({ id: "a", status: "DIRTY" }));
    registry.register(
      createEntryInput({
        id: "b",
        status: "DIRTY",
        isBlocking: false,
        scope: "GLOBAL",
      }),
    );

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.hasBlockingChanges()).toBe(true);
    expect(registry.getBlockingEntries()).toHaveLength(1);
  });

  it("queries by scope, route, school, resource, and owner", () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "school-a",
        scope: "SCHOOL",
        owner: "school-module",
        metadata: { schoolId: "s1" },
      }),
    );
    registry.register(
      createEntryInput({
        id: "route-a",
        scope: "ROUTE",
        owner: "route-module",
        metadata: { route: "/studio" },
      }),
    );
    registry.register(
      createEntryInput({
        id: "resource-a",
        scope: "RESOURCE",
        owner: "resource-module",
        metadata: { resourceType: "course-draft", resourceId: "c1" },
      }),
    );

    expect(registry.queryByScope("SCHOOL")).toHaveLength(1);
    expect(registry.queryByRoute("/studio")).toHaveLength(1);
    expect(registry.queryBySchool("s1")).toHaveLength(1);
    expect(
      registry.queryByResource("course-draft", "c1"),
    ).toHaveLength(1);
    expect(registry.queryByOwner("route-module")).toHaveLength(1);
  });

  it("saves one entry and updates status to CLEAN on success", async () => {
    const registry = createRegistry();
    registry.register(createEntryInput({ id: "a", status: "DIRTY" }));

    const result = await registry.saveOne("a");

    expect(result.status).toBe("success");
    expect(registry.get("a")?.status).toBe("CLEAN");
  });

  it("sets SAVE_FAILED when save rejects", async () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        saveResult: undefined,
        save: async () => {
          throw new Error("network error");
        },
      }),
    );

    const result = await registry.saveOne("a");

    expect(result.status).toBe("failed");
    expect(result.message).toBe("network error");
    expect(registry.get("a")?.status).toBe("SAVE_FAILED");
  });

  it("sets CONFLICT when save reports conflict", async () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        saveResult: { status: "conflict" as const, message: "conflict" },
      }),
    );

    const result = await registry.saveOne("a");

    expect(result.status).toBe("conflict");
    expect(registry.get("a")?.status).toBe("CONFLICT");
  });

  it("sets WAITING_SYNC when save reports unauthorized", async () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        saveResult: {
          status: "unauthorized" as const,
          message: "session expired",
        },
      }),
    );

    const result = await registry.saveOne("a");

    expect(result.status).toBe("unauthorized");
    expect(registry.get("a")?.status).toBe("WAITING_SYNC");
  });

  it("saveAll returns per-entry results with partial failure", async () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        saveResult: { status: "success" as const },
      }),
    );
    registry.register(
      createEntryInput({
        id: "b",
        status: "DIRTY",
        saveResult: { status: "failed" as const, message: "fail" },
      }),
    );

    const results = await registry.saveAll();

    expect(results.a.status).toBe("success");
    expect(results.b.status).toBe("failed");
    expect(registry.get("a")?.status).toBe("CLEAN");
    expect(registry.get("b")?.status).toBe("SAVE_FAILED");
  });

  it("does not save entries that cannot auto-save", async () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        canAutoSave: false,
        saveResult: { status: "success" as const },
      }),
    );

    const result = await registry.saveOne("a");

    expect(result.status).toBe("failed");
    expect(registry.get("a")?.status).toBe("DIRTY");
  });

  it("discards one entry and unregisters it", async () => {
    const registry = createRegistry();
    let discarded = false;
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        discard: async () => {
          discarded = true;
        },
      }),
    );

    await registry.discardOne("a");

    expect(discarded).toBe(true);
    expect(registry.has("a")).toBe(false);
  });

  it("restores DIRTY when discard rejects", async () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "a",
        status: "DIRTY",
        discard: async () => {
          throw new Error("discard failed");
        },
      }),
    );

    await registry.discardOne("a");

    expect(registry.get("a")?.status).toBe("DIRTY");
  });

  it("clears entries by scope with optional metadata filter", () => {
    const registry = createRegistry();
    registry.register(
      createEntryInput({
        id: "s1",
        scope: "SCHOOL",
        metadata: { schoolId: "school-a" },
      }),
    );
    registry.register(
      createEntryInput({
        id: "s2",
        scope: "SCHOOL",
        metadata: { schoolId: "school-b" },
      }),
    );
    registry.register(
      createEntryInput({ id: "g1", scope: "GLOBAL" }),
    );

    registry.clearScope("SCHOOL", { schoolId: "school-a" });

    expect(registry.has("s1")).toBe(false);
    expect(registry.has("s2")).toBe(true);
    expect(registry.has("g1")).toBe(true);
  });

  it("emits change events on register, status change, and unregister", () => {
    const registry = createRegistry();
    let changes = 0;
    registry.onChange(() => {
      changes++;
    });

    registry.register(createEntryInput({ id: "a" }));
    registry.markDirty("a");
    registry.unregister("a");

    expect(changes).toBeGreaterThanOrEqual(3);
  });
});
