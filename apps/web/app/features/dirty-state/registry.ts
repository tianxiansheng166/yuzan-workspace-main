import type {
  DirtyEntryInput,
  DirtyLeaveRequest,
  DirtyScope,
  DirtyStateEntry,
  DirtyStateEntrySaveResult,
  DirtyStatus,
  LeaveDecision,
  LeaveReason,
} from "./types";

export class DirtyStateRegistry {
  private entries = new Map<string, DirtyStateEntry>();
  private leaveRequest: DirtyLeaveRequest | null = null;
  private leaveListeners = new Set<() => void>();
  private changeListeners = new Set<() => void>();

  register<T>(input: DirtyEntryInput<T>): DirtyStateEntry<T> {
    if (this.entries.has(input.id)) {
      throw new Error(`Dirty state entry already registered: ${input.id}`);
    }

    const entry: DirtyStateEntry<T> = {
      ...input,
      updatedAt: input.updatedAt ?? Date.now(),
    };

    this.entries.set(input.id, entry as DirtyStateEntry);
    this.emitChange();
    return entry;
  }

  unregister(id: string): void {
    if (this.entries.delete(id)) {
      this.emitChange();
    }
  }

  get(id: string): DirtyStateEntry | undefined {
    return this.entries.get(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  markDirty(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (entry.status === "DIRTY") return;
    entry.status = "DIRTY";
    entry.updatedAt = Date.now();
    this.emitChange();
  }

  markClean(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (entry.status === "CLEAN") return;
    entry.status = "CLEAN";
    entry.updatedAt = Date.now();
    this.emitChange();
  }

  updateStatus(id: string, status: DirtyStatus): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (entry.status === status) return;
    entry.status = status;
    entry.updatedAt = Date.now();
    this.emitChange();
  }

  updateEntry(id: string, patch: Partial<Omit<DirtyStateEntry, "id">>): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    Object.assign(entry, patch);
    entry.updatedAt = Date.now();
    this.emitChange();
  }

  getAll(): DirtyStateEntry[] {
    return Array.from(this.entries.values());
  }

  getBlockingEntries(): DirtyStateEntry[] {
    return this.getAll().filter(
      (entry) => entry.isBlocking && !isTerminalClean(entry.status),
    );
  }

  hasBlockingChanges(): boolean {
    return this.getBlockingEntries().length > 0;
  }

  hasDirtyChanges(): boolean {
    return this.getAll().some((entry) => !isTerminalClean(entry.status));
  }

  queryByScope(scope: DirtyScope): DirtyStateEntry[] {
    return this.getAll().filter((entry) => entry.scope === scope);
  }

  queryByRoute(route: string): DirtyStateEntry[] {
    return this.getAll().filter(
      (entry) =>
        entry.scope === "ROUTE" &&
        (entry.metadata as Record<string, unknown> | undefined)?.route ===
          route,
    );
  }

  queryBySchool(schoolId: string): DirtyStateEntry[] {
    return this.getAll().filter(
      (entry) =>
        entry.scope === "SCHOOL" &&
        (entry.metadata as Record<string, unknown> | undefined)?.schoolId ===
          schoolId,
    );
  }

  queryByResource(resourceType: string, resourceId: string): DirtyStateEntry[] {
    return this.getAll().filter(
      (entry) =>
        entry.scope === "RESOURCE" &&
        (entry.metadata as Record<string, unknown> | undefined)
          ?.resourceType === resourceType &&
        (entry.metadata as Record<string, unknown> | undefined)?.resourceId ===
          resourceId,
    );
  }

  queryByOwner(owner: string): DirtyStateEntry[] {
    return this.getAll().filter((entry) => entry.owner === owner);
  }

  async saveOne(id: string): Promise<DirtyStateEntrySaveResult> {
    const entry = this.entries.get(id);
    if (!entry) {
      return { status: "failed", message: "未找到未保存条目" };
    }
    if (!entry.canAutoSave) {
      return {
        status: "failed",
        message: "该条目不支持自动保存",
      };
    }
    if (entry.status === "SAVING") {
      return { status: "failed", message: "保存已在进行中" };
    }
    entry.status = "SAVING";
    this.emitChange();

    try {
      const result = await entry.save();
      entry.status = mapSaveResultToStatus(result.status);
      entry.updatedAt = Date.now();
      this.emitChange();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      entry.status = "SAVE_FAILED";
      entry.updatedAt = Date.now();
      this.emitChange();
      return { status: "failed", message };
    }
  }

  async saveAll(
    filter?: (entry: DirtyStateEntry) => boolean,
  ): Promise<Record<string, DirtyStateEntrySaveResult>> {
    const targets = this.getAll().filter(
      (entry) =>
        entry.canAutoSave &&
        !isTerminalClean(entry.status) &&
        (!filter || filter(entry)),
    );

    const results: Record<string, DirtyStateEntrySaveResult> = {};

    for (const entry of targets) {
      results[entry.id] = await this.saveOne(entry.id);
    }

    return results;
  }

  async discardOne(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (!entry.canDiscard) return;
    if (entry.status === "DISCARDING") return;

    entry.status = "DISCARDING";
    this.emitChange();

    try {
      await entry.discard();
      this.unregister(id);
    } catch {
      entry.status = "DIRTY";
      entry.updatedAt = Date.now();
      this.emitChange();
    }
  }

  async discardAll(
    filter?: (entry: DirtyStateEntry) => boolean,
  ): Promise<void> {
    const targets = this.getAll().filter(
      (entry) => !isTerminalClean(entry.status) && (!filter || filter(entry)),
    );

    await Promise.all(targets.map((entry) => this.discardOne(entry.id)));
  }

  clearScope(scope: DirtyScope, metadataFilter?: Record<string, unknown>): void {
    for (const [id, entry] of this.entries) {
      if (entry.scope !== scope) continue;
      if (metadataFilter && !matchesMetadata(entry.metadata, metadataFilter)) {
        continue;
      }
      this.entries.delete(id);
    }
    this.emitChange();
  }

  clear(): void {
    if (this.entries.size === 0) return;
    this.entries.clear();
    this.emitChange();
  }

  requestLeave(reason: LeaveReason): Promise<LeaveDecision> {
    if (this.leaveRequest) {
      return Promise.resolve("stay");
    }

    const blocking = this.getBlockingEntries();
    if (blocking.length === 0) {
      return Promise.resolve("save-and-leave");
    }

    return new Promise<LeaveDecision>((resolve) => {
      this.leaveRequest = { reason, blockingEntries: blocking, resolve };
      this.emitLeave();
    });
  }

  getLeaveRequest(): DirtyLeaveRequest | null {
    return this.leaveRequest;
  }

  resolveLeave(decision: LeaveDecision): void {
    const request = this.leaveRequest;
    if (!request) return;
    this.leaveRequest = null;
    request.resolve(decision);
    this.emitChange();
  }

  cancelLeave(): void {
    this.resolveLeave("stay");
  }

  onLeave(listener: () => void): () => void {
    this.leaveListeners.add(listener);
    return () => {
      this.leaveListeners.delete(listener);
    };
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private emitLeave(): void {
    for (const listener of this.leaveListeners) {
      listener();
    }
  }

  private emitChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}

function isTerminalClean(status: DirtyStatus): boolean {
  return status === "CLEAN" || status === "SAVED_LOCAL";
}

function mapSaveResultToStatus(
  result: DirtyStateEntrySaveResult["status"],
): DirtyStatus {
  switch (result) {
    case "success":
      return "CLEAN";
    case "conflict":
      return "CONFLICT";
    case "unauthorized":
      return "WAITING_SYNC";
    case "failed":
    default:
      return "SAVE_FAILED";
  }
}

function matchesMetadata(
  metadata: unknown,
  filter: Record<string, unknown>,
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const record = metadata as Record<string, unknown>;
  return Object.entries(filter).every(([key, value]) => record[key] === value);
}
