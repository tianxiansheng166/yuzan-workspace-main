import { beforeEach, describe, expect, it } from "vitest";

import {
  createLeaveCoordinator,
  resetLeaveCoordinator,
} from "../../app/features/dirty-state/leave-coordinator";
import { getDirtyStateRegistry } from "../../app/features/dirty-state/composables/useDirtyStateRegistry";
import type { Router } from "vue-router";

function createFakeRouter(): Router {
  return {
    push: async () => {},
    replace: async () => {},
    beforeEach: () => () => {},
  } as unknown as Router;
}

function createEntry(id: string, status: "CLEAN" | "DIRTY", overrides: Partial<{
  scope: import("../../app/features/dirty-state/types").DirtyScope;
  canAutoSave: boolean;
  canDiscard: boolean;
  isBlocking: boolean;
}> = {}) {
  return {
    id,
    scope: overrides.scope ?? "RESOURCE",
    owner: "test",
    title: `Entry ${id}`,
    status,
    canAutoSave: overrides.canAutoSave ?? true,
    canDiscard: overrides.canDiscard ?? true,
    isBlocking: overrides.isBlocking ?? true,
    save: async () => ({ status: "success" as const }),
    discard: async () => {},
  };
}

describe("LeaveCoordinator", () => {
  beforeEach(() => {
    resetLeaveCoordinator();
    getDirtyStateRegistry().clear();
  });
  it("allows route leave when no blocking changes", async () => {
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });

    const allowed = await coordinator.requestRouteLeave("/other");

    expect(allowed).toBe(true);
  });

  it("opens leave request and allows save-and-continue", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY"));

    const leavePromise = coordinator.requestRouteLeave("/other");
    expect(registry.getLeaveRequest()).not.toBeNull();

    registry.resolveLeave("save-and-leave");
    const allowed = await leavePromise;

    expect(allowed).toBe(true);
    expect(registry.get("a")?.status).toBe("CLEAN");
  });

  it("allows discard-and-continue", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY"));

    const leavePromise = coordinator.requestRouteLeave("/other");
    registry.resolveLeave("discard-and-leave");
    const allowed = await leavePromise;

    expect(allowed).toBe(true);
    expect(registry.has("a")).toBe(false);
  });

  it("allows stay editing", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY"));

    const leavePromise = coordinator.requestRouteLeave("/other");
    registry.resolveLeave("stay");
    const allowed = await leavePromise;

    expect(allowed).toBe(false);
    expect(registry.get("a")?.status).toBe("DIRTY");
  });

  it("prevents concurrent leave requests", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY"));

    const first = coordinator.requestRouteLeave("/first");
    const second = coordinator.requestRouteLeave("/second");

    registry.resolveLeave("stay");
    const [r1, r2] = await Promise.all([first, second]);

    expect(r1).toBe(false);
    expect(r2).toBe(false);
  });

  it("handles school switch with blocking changes", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY", { scope: "SCHOOL" }));

    const leavePromise = coordinator.requestSchoolSwitch();
    expect(registry.getLeaveRequest()?.reason.kind).toBe("school-switch");

    registry.resolveLeave("save-and-leave");
    const allowed = await leavePromise;

    expect(allowed).toBe(true);
  });

  it("handles logout with blocking changes", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY"));

    const leavePromise = coordinator.requestLogout();
    expect(registry.getLeaveRequest()?.reason.kind).toBe("logout");

    registry.resolveLeave("discard-and-leave");
    const allowed = await leavePromise;

    expect(allowed).toBe(true);
    expect(registry.has("a")).toBe(false);
  });

  it("reports blocking changes for beforeunload", () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });

    expect(coordinator.requestBeforeUnload()).toBe(false);

    registry.register(createEntry("a", "DIRTY"));
    expect(coordinator.requestBeforeUnload()).toBe(true);
  });

  it("bypasses guard inside bypassNavigation", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register(createEntry("a", "DIRTY"));

    const allowed = await coordinator.bypassNavigation(async () =>
      coordinator.requestRouteLeave("/other"),
    );

    expect(allowed).toBe(true);
  });

  it("saveAll keeps failed entries and resolves partial failure", async () => {
    resetLeaveCoordinator();
    const registry = getDirtyStateRegistry();
    const router = createFakeRouter();
    const coordinator = createLeaveCoordinator({ router });
    registry.register({
      ...createEntry("a", "DIRTY"),
      save: async () => ({ status: "success" as const }),
    });
    registry.register({
      ...createEntry("b", "DIRTY"),
      save: async () => ({ status: "failed" as const, message: "fail" }),
    });

    const results = await coordinator.saveEntries(registry.getBlockingEntries());

    expect(results.a.status).toBe("success");
    expect(results.b.status).toBe("failed");
    expect(registry.get("a")?.status).toBe("CLEAN");
    expect(registry.get("b")?.status).toBe("SAVE_FAILED");
  });
});
