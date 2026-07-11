import { getCurrentScope, onScopeDispose, readonly, shallowRef } from "vue";

import { getDirtyStateRegistry } from "./useDirtyStateRegistry";
import type {
  DirtyEntryInput,
  DirtyStateEntry,
  DirtyStateEntrySaveResult,
  DirtyStatus,
} from "../types";

export interface UseDirtyStateOptions<T = unknown> extends DirtyEntryInput<T> {
  autoRegister?: boolean;
}

export function useDirtyState<T = unknown>(options: UseDirtyStateOptions<T>) {
  const registry = getDirtyStateRegistry();
  const autoRegister = options.autoRegister ?? true;
  const entryRef = shallowRef<DirtyStateEntry<T> | null>(null);

  function register(): DirtyStateEntry<T> {
    if (entryRef.value) return entryRef.value;
    if (registry.has(options.id)) {
      throw new Error(
        `Dirty state entry ${options.id} is already registered by another owner`,
      );
    }
    entryRef.value = registry.register(options);
    return entryRef.value;
  }

  function unregister(): void {
    if (!entryRef.value) return;
    registry.unregister(entryRef.value.id);
    entryRef.value = null;
  }

  function markDirty(): void {
    registry.markDirty(options.id);
  }

  function markClean(): void {
    registry.markClean(options.id);
  }

  function updateStatus(status: DirtyStatus): void {
    registry.updateStatus(options.id, status);
  }

  function updateEntry(
    patch: Partial<Omit<DirtyStateEntry<T>, "id">>,
  ): void {
    registry.updateEntry(options.id, patch);
  }

  async function save(): Promise<DirtyStateEntrySaveResult> {
    return registry.saveOne(options.id);
  }

  async function discard(): Promise<void> {
    return registry.discardOne(options.id);
  }

  if (autoRegister) {
    register();
    if (getCurrentScope()) {
      onScopeDispose(unregister);
    }
  }

  return {
    entry: readonly(entryRef),
    register,
    unregister,
    markDirty,
    markClean,
    updateStatus,
    updateEntry,
    save,
    discard,
  };
}
