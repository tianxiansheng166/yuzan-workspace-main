import { getDirtyStateRegistry } from "./composables/useDirtyStateRegistry";
import type {
  DirtyStateEntry,
  DirtyStateEntrySaveResult,
  LeaveDecision,
  LeaveReason,
} from "./types";

const BYPASS_DIRTY_GUARD_KEY = "__yuzan_dirty_guard_bypass__";

let coordinatorInstance: LeaveCoordinator | null = null;
let bypassGuard = false;

export interface RouterLike {
  push: (to: string) => Promise<unknown>;
  replace?: (to: string) => Promise<unknown>;
}

export interface LeaveCoordinatorOptions {
  router: RouterLike;
}

export interface LeaveCoordinator {
  requestRouteLeave(to: string): Promise<boolean>;
  requestSchoolSwitch(): Promise<boolean>;
  requestLogout(): Promise<boolean>;
  requestBeforeUnload(): boolean;
  executeDecision(decision: LeaveDecision, reason: LeaveReason): Promise<void>;
  saveEntries(
    entries: readonly DirtyStateEntry[],
  ): Promise<Record<string, DirtyStateEntrySaveResult>>;
  discardEntries(entries: readonly DirtyStateEntry[]): Promise<void>;
  bypassNavigation<T>(action: () => Promise<T>): Promise<T>;
}

export function createLeaveCoordinator(
  options: LeaveCoordinatorOptions,
): LeaveCoordinator {
  if (coordinatorInstance) {
    return coordinatorInstance;
  }

  const { router } = options;
  const registry = getDirtyStateRegistry();

  async function resolveAndProceed(
    reason: LeaveReason,
    onProceed: () => Promise<void> | void,
  ): Promise<boolean> {
    const decision = await registry.requestLeave(reason);

    if (decision === "stay") {
      return false;
    }

    await executeDecision(decision, reason);
    await onProceed();
    return true;
  }

  async function executeDecision(
    decision: LeaveDecision,
    reason: LeaveReason,
  ): Promise<void> {
    const blocking = registry.getBlockingEntries();

    if (decision === "save-and-leave") {
      await saveEntries(blocking);
    } else if (decision === "discard-and-leave") {
      await discardEntries(blocking);
    }

    registry.resolveLeave(decision);
  }

  async function saveEntries(
    entries: DirtyStateEntry[],
  ): Promise<Record<string, DirtyStateEntrySaveResult>> {
    const results: Record<string, DirtyStateEntrySaveResult> = {};
    for (const entry of entries) {
      results[entry.id] = await registry.saveOne(entry.id);
    }
    return results;
  }

  async function discardEntries(entries: DirtyStateEntry[]): Promise<void> {
    await Promise.all(entries.map((entry) => registry.discardOne(entry.id)));
  }

  async function bypassNavigation<T>(action: () => Promise<T>): Promise<T> {
    bypassGuard = true;
    try {
      return await action();
    } finally {
      bypassGuard = false;
    }
  }

  coordinatorInstance = {
    async requestRouteLeave(to: string): Promise<boolean> {
      if (bypassGuard) return true;
      if (!registry.hasBlockingChanges()) return true;

      return resolveAndProceed({ kind: "route", to }, async () => {
        await bypassNavigation(async () => {
          await router.push(to);
        });
      });
    },

    async requestSchoolSwitch(): Promise<boolean> {
      if (bypassGuard) return true;
      if (!registry.hasBlockingChanges()) return true;

      return resolveAndProceed(
        { kind: "school-switch" },
        () => Promise.resolve(),
      );
    },

    async requestLogout(): Promise<boolean> {
      if (bypassGuard) return true;
      if (!registry.hasBlockingChanges()) return true;

      return resolveAndProceed({ kind: "logout" }, () => Promise.resolve());
    },

    requestBeforeUnload(): boolean {
      if (bypassGuard) return false;
      return registry.hasBlockingChanges();
    },

    executeDecision,
    saveEntries,
    discardEntries,
    bypassNavigation,
  };

  return coordinatorInstance;
}

export function getLeaveCoordinator(): LeaveCoordinator | null {
  return coordinatorInstance;
}

export function resetLeaveCoordinator(): void {
  coordinatorInstance = null;
}

export function markNavigationBypassed(to: unknown): void {
  if (typeof to === "object" && to !== null) {
    (to as Record<string, unknown>)[BYPASS_DIRTY_GUARD_KEY] = true;
  }
}

export function isNavigationBypassed(to: unknown): boolean {
  return (
    typeof to === "object" &&
    to !== null &&
    (to as Record<string, unknown>)[BYPASS_DIRTY_GUARD_KEY] === true
  );
}
