import { computed, onScopeDispose, readonly, ref } from "vue";

import { DirtyStateRegistry } from "../registry";
import type { DirtyLeaveRequest, DirtyStateEntry } from "../types";

const globalRegistry = new DirtyStateRegistry();
const isClient = typeof window !== "undefined";

export function useDirtyStateRegistry() {
  const entries = ref<DirtyStateEntry[]>(globalRegistry.getAll());
  const leaveRequest = ref<DirtyLeaveRequest | null>(
    globalRegistry.getLeaveRequest(),
  );

  const unblockChange = globalRegistry.onChange(() => {
    entries.value = globalRegistry.getAll();
    leaveRequest.value = globalRegistry.getLeaveRequest();
  });

  const unblockLeave = globalRegistry.onLeave(() => {
    leaveRequest.value = globalRegistry.getLeaveRequest();
  });

  onScopeDispose(() => {
    unblockChange();
    unblockLeave();
  });

  const blockingEntries = computed(() =>
    entries.value.filter(
      (entry) => entry.isBlocking && !isTerminalClean(entry.status),
    ),
  );

  const hasBlockingChanges = computed(() => blockingEntries.value.length > 0);
  const hasDirtyChanges = computed(() =>
    entries.value.some((entry) => !isTerminalClean(entry.status)),
  );

  return {
    registry: globalRegistry,
    entries: readonly(entries),
    blockingEntries,
    hasBlockingChanges,
    hasDirtyChanges,
    leaveRequest: readonly(leaveRequest),
    isClient: readonly(ref(isClient)),
  };
}

export function getDirtyStateRegistry(): DirtyStateRegistry {
  return globalRegistry;
}

function isTerminalClean(status: string): boolean {
  return status === "CLEAN" || status === "SAVED_LOCAL";
}
